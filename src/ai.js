const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Config = require('./utils/config');
const Logger = require('./utils/logger');

class AIHandler {
    constructor() {
        this.config = Config;

        if (!this.config.GROQ_API_KEY) {
            throw new Error('❌ GROQ_API_KEY chưa cấu hình');
        }

        this.apiConfig = {
            url: this.config.GROQ_API_URL,
            headers: {
                'Authorization': `Bearer ${this.config.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        };

        /* ========= HISTORY ========= */
        // Map<userId, { messages: [], lastAccess }>
        this.publicHistories = new Map();
        this.privateHistories = new Map();
        this.maxHistory = this.config.MAX_HISTORY || 6;

        /* ========= CACHE ========= */
        this.requestCache = new Map();
        this.cacheDuration = 30_000;
        this.maxCacheSize = 200;

        /* ========= RULES ========= */
        this.rulesPath = path.join(__dirname, 'rules.json');
        this.rules = this.loadRules();
        this.watchRulesFile();

        /* ========= CLEANUP ========= */
        this.startMemoryCleanup();

        Logger.success('✅ AIHandler initialized');
    }

    /* ================= RULES ================= */

    loadRules() {
        try {
            const raw = fs.readFileSync(this.rulesPath, 'utf8');
            Logger.success('🔧 rules.json loaded');
            return JSON.parse(raw);
        } catch (e) {
            Logger.error('❌ Không đọc được rules.json', e.message);
            return { core: '', public: '', private: '', search: '' };
        }
    }

    watchRulesFile() {
        fs.watchFile(this.rulesPath, { interval: 2000 }, () => {
            this.rules = this.loadRules();
            Logger.success('♻️ rules.json reloaded (no restart)');
        });
    }

    /* ================= PUBLIC API ================= */

    askPublic(userId, question, context = 'general') {
        return this.processRequest(userId, question, this.publicHistories, 'public', context);
    }

    askPrivate(userId, question) {
        return this.processRequest(userId, question, this.privateHistories, 'private', 'private');
    }

    search(userId, query) {
        return this.processRequest(
            userId,
            `🔍 Tìm kiếm: ${query}`,
            this.publicHistories,
            'search',
            'search'
        );
    }

    /* ================= CORE ================= */

    async processRequest(userId, question, map, type, context) {
        const start = Date.now();
        const cacheKey = this.createCacheKey(userId, type, question, context);

        const cached = this.requestCache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.cacheDuration) {
            return cached.data;
        }

        try {
            const historyData = this.getHistory(map, userId);
            const messages = this.buildMessages(historyData, question, type, context);

            const res = await axios.post(this.apiConfig.url, {
                model: this.config.GROQ_MODEL,
                messages,
                max_tokens: this.config.MAX_TOKENS || 1024,
                temperature: type === 'search' ? 0.3 : 0.7
            }, this.apiConfig);

            const reply = res.data?.choices?.[0]?.message?.content;
            if (!reply) throw new Error('Empty response');

            this.updateHistory(historyData, question, reply);
            this.saveCache(cacheKey, reply);

            Logger.success(`✅ ${type.toUpperCase()} (${Date.now() - start}ms)`);
            return reply;

        } catch (err) {
            return this.handleError(err, Date.now() - start);
        }
    }

    /* ================= PROMPT ================= */

    buildMessages(historyData, question, type, context) {
        const systemPrompt =
            this.rules.core +
            (this.rules[type] || '') +
            `\nContext: ${context || ''}`;

        const messages = [{ role: 'system', content: systemPrompt }];

        const MAX_CHARS = 6000;
        let total = 0;

        for (let i = historyData.messages.length - 1; i >= 0; i--) {
            total += historyData.messages[i].content.length;
            if (total > MAX_CHARS) break;
            messages.unshift(historyData.messages[i]);
        }

        messages.push({ role: 'user', content: question });
        return messages;
    }

    /* ================= HISTORY ================= */

    getHistory(map, userId) {
        if (!map.has(userId)) {
            map.set(userId, { messages: [], lastAccess: Date.now() });
        }
        const data = map.get(userId);
        data.lastAccess = Date.now();
        return data;
    }

    updateHistory(data, question, answer) {
        data.messages.push({ role: 'user', content: question.slice(0, 500) });
        data.messages.push({ role: 'assistant', content: answer.slice(0, 1200) });

        const max = this.maxHistory * 2;
        if (data.messages.length > max) {
            data.messages.splice(0, data.messages.length - max);
        }
    }

    /* ================= HISTORY INFO ================= */
    getHistoryInfo(userId) {
        const publicHistory = this.publicHistories.has(userId) ? this.publicHistories.get(userId).messages : [];
        const privateHistory = this.privateHistories.has(userId) ? this.privateHistories.get(userId).messages : [];

        return {
            public: { history: publicHistory },
            private: { history: privateHistory }
        };
    }

    /* ================= CLEAR HISTORY ================= */
    clearAllHistory(userId) {
        let count = 0;
        if (this.publicHistories.has(userId)) {
            count += this.publicHistories.get(userId).messages.length;
            this.publicHistories.delete(userId);
            this.clearCache(userId, 'public');
        }
        if (this.privateHistories.has(userId)) {
            count += this.privateHistories.get(userId).messages.length;
            this.privateHistories.delete(userId);
            this.clearCache(userId, 'private');
        }
        return count;
    }

    /* ================= CLEANUP ================= */

    startMemoryCleanup() {
        const EXPIRE = 2 * 60 * 60 * 1000; // 2h

        setInterval(() => {
            const now = Date.now();
            const clean = (map, type) => {
                for (const [uid, data] of map.entries()) {
                    if (now - data.lastAccess > EXPIRE) {
                        map.delete(uid);
                        this.clearCache(uid, type);
                        Logger.info(`🧹 Cleanup ${type}: ${uid.slice(0, 6)}`);
                    }
                }
            };
            clean(this.publicHistories, 'public');
            clean(this.privateHistories, 'private');
        }, 10 * 60 * 1000);
    }

    /* ================= CACHE ================= */

    createCacheKey(uid, type, q, ctx) {
        const hash = crypto.createHash('md5').update(q + ctx).digest('hex');
        return `${uid}:${type}:${hash}`;
    }

    saveCache(key, data) {
        this.requestCache.set(key, { data, time: Date.now() });
        if (this.requestCache.size > this.maxCacheSize) {
            this.requestCache.delete(this.requestCache.keys().next().value);
        }
    }

    clearCache(uid, type) {
        for (const k of this.requestCache.keys()) {
            if (k.startsWith(`${uid}:${type}:`)) {
                this.requestCache.delete(k);
            }
        }
    }

    /* ================= ERROR ================= */

    handleError(err, time) {
        Logger.error('❌ AI Error', err.message);
        if (err.response?.status === 429) return '⚠️ Quá nhiều request, thử lại sau';
        if (err.code === 'ECONNABORTED') return '⏰ AI phản hồi quá chậm';
        return '❌ Có lỗi xảy ra';
    }
}

module.exports = new AIHandler();
