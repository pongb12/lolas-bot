// src/utils/promptFirewall.js
const path = require('path');
const fs = require('fs');
const Logger = require('./logger');
const Config = require('./config');

class PromptFirewall {
    constructor() {
        this.classifier = null;
        this.isReady = false;
        this.ownerDebug = false;

        // Heuristic patterns
        this.criticalPatterns = [
            /ignore (all )?previous/i,
            /system (prompt|message|instruction)s?/i,
            /hãy in (toàn bộ )?prompt/i,
            /show (me )?the prompt/i,
            /dưới đây là các luật/i,
            /reveal the system/i
        ];

        this.whitelist = [
            /máy bay/i, /thời tiết/i, /nấu ăn/i, /học tập/i
        ];

        this.attempts = new Map(); // userId -> [timestamps]
        this.bannedUsers = new Map(); // userId -> banUntilTimestamp
        this.BAN_THRESHOLD = Number(Config.BAN_THRESHOLD) || 5;
        this.BAN_DURATION = Number(Config.BAN_DURATION) || 24 * 60 * 60 * 1000; // default 24h
        this.ATTEMPT_WINDOW = Number(Config.ATTEMPT_WINDOW_MS) || 10 * 60 * 1000; // 10 minutes

        // start cleanup loop for attempts & bans
        this._cleanupInterval = null;
        this.startCleanup();

        // Try initialize AI model, but fail gracefully
        this.initAI();
    }

    async initAI() {
        try {
            // Attempt dynamic import of xenova transformers (may fail on server without HF token)
            const mod = await import('@xenova/transformers');
            const { pipeline, env } = mod;
            env.allowLocalModels = false;
            env.useBrowserCache = false;

            // Try to load model - may throw if restricted
            try {
                this.classifier = await pipeline('text-classification', 'Xenova/llama-prompt-guard-2-86m');
                this.isReady = true;
                Logger.success('🧠 PromptFirewall: AI Model Loaded (Llama-86M)');
            } catch (err) {
                Logger.warn('🧠 PromptFirewall: model load failed, falling back to heuristic mode. ' + (err?.message || err));
                this.classifier = null;
                this.isReady = false;
            }
        } catch (e) {
            // Import failed (likely package not available in environment)
            Logger.info('🧠 PromptFirewall: transformers not available - using heuristic-only mode.');
            this.classifier = null;
            this.isReady = false;
        }
    }

    /* ================= ANALYZE ================= */
    async analyzeContent(text) {
        if (!text || typeof text !== 'string') return { safe: true };

        const lowerText = text.toLowerCase();

        // Whitelist
        if (this.whitelist.some(p => p.test(lowerText))) {
            return { safe: true, reason: 'whitelist' };
        }

        // Regex critical
        if (this.criticalPatterns.some(p => p.test(lowerText))) {
            return { safe: false, reason: 'critical_regex', confidence: 1.0 };
        }

        // If AI classifier ready, use model
        if (this.isReady && this.classifier) {
            try {
                const results = await this.classifier(text);
                // Depending on model output format; handle gracefully
                const label = results?.[0]?.label || 'BENIGN';
                const score = results?.[0]?.score || 0;
                const isAttack = label && label.toUpperCase() !== 'BENIGN';

                if (isAttack && score > 0.85) {
                    return { safe: false, reason: 'ai_detected', confidence: score };
                }
            } catch (err) {
                Logger.warn('PromptFirewall AI analyze error: ' + (err?.message || err));
                // fallback to safe: true (we already checked regex)
            }
        }

        return { safe: true };
    }

    /* ================= TRACK / BAN ================= */
    async trackAttempt(userId, question) {
        // Owner bypass - allow but can record if ownerDebug enabled
        if (userId === Config.OWNER_ID) {
            return { allowed: true, isOwner: true };
        }

        // check ban
        if (this.isBanned(userId)) {
            return { allowed: false, reason: 'banned' };
        }

        const analysis = await this.analyzeContent(question);

        if (!analysis.safe) {
            Logger.warn(`🚨 Security: User ${userId} triggered ${analysis.reason} (${analysis.confidence || 0})`);
            const now = Date.now();
            const arr = this.attempts.get(userId) || [];
            // remove old attempts
            const filtered = arr.filter(t => now - t < this.ATTEMPT_WINDOW);
            filtered.push(now);
            this.attempts.set(userId, filtered);

            if (filtered.length >= this.BAN_THRESHOLD) {
                this.banUser(userId, `auto: ${analysis.reason}`);
                return { allowed: false, reason: 'banned' };
            }

            return { allowed: false, reason: 'warning' };
        }

        // allowed
        return { allowed: true };
    }

    banUser(userId, reason = 'auto') {
        const until = Date.now() + this.BAN_DURATION;
        this.bannedUsers.set(userId, until);
        Logger.error(`🚫 User ${userId} banned until ${new Date(until).toISOString()} (reason: ${reason})`);
    }

    unbanUser(userId) {
        if (this.bannedUsers.has(userId)) {
            this.bannedUsers.delete(userId);
            Logger.success(`✅ unbanned ${userId}`);
            return true;
        }
        return false;
    }

    isBanned(userId) {
        const until = this.bannedUsers.get(userId);
        if (!until) return false;
        if (Date.now() > until) {
            this.bannedUsers.delete(userId);
            return false;
        }
        return true;
    }

    /* ================= UTILITIES required by ai.js ================= */

    // Basic "isPromptLeakAttempt" wrapper
    isPromptLeakAttempt(text) {
        // synchronous quick check: match critical regex
        if (!text || typeof text !== 'string') return false;
        const t = text.toLowerCase();
        if (this.criticalPatterns.some(p => p.test(t))) return true;
        // further checks could be async (ai), but keep sync for this helper
        return false;
    }

    // sanitizeResponse: redact suspicious keywords and URLs
    sanitizeResponse(text) {
        if (!text || typeof text !== 'string') return text;

        // redact system keywords
        let s = text
            .replace(/(system prompt|system message|system instruction|system rules|prompt)/gi, '[REDACTED]')
            .replace(/(instruction|configuration|internal configuration)/gi, '[REDACTED]');

        // redact huggingface / model urls
        s = s.replace(/https?:\/\/(www\.)?huggingface\.co[^\s]*/gi, '[REDACTED_URL]');
        s = s.replace(/https?:\/\/(www\.)?github\.com[^\s]*/gi, '[REDACTED_URL]');

        // If ownerDebug enabled, include additional info (otherwise keep silent)
        if (this.ownerDebug) {
            s += '\n\n[DEBUG: response sanitized by PromptFirewall]';
        }

        return s;
    }

    getBannedUsers() {
        const arr = [];
        for (const [uid, until] of this.bannedUsers.entries()) {
            arr.push({ userId: uid, until });
        }
        return arr;
    }

    getSecurityStats() {
        return {
            attemptsCount: this.attempts.size,
            bannedCount: this.bannedUsers.size,
            banThreshold: this.BAN_THRESHOLD,
            banDurationMs: this.BAN_DURATION
        };
    }

    setOwnerDebugMode(enabled = false) {
        this.ownerDebug = !!enabled;
    }

    /* ================= CLEANUP (startCleanup) ================= */

    startCleanup() {
        try {
            // If already running, skip
            if (this._cleanupInterval) return;

            const intervalMs = Number(Config.FIREWALL_CLEANUP_INTERVAL_MS) || 60 * 1000; // default 60s
            this._cleanupInterval = setInterval(() => {
                const now = Date.now();
                // prune attempts older than ATTEMPT_WINDOW
                for (const [uid, arr] of this.attempts.entries()) {
                    const filtered = (arr || []).filter(t => now - t < this.ATTEMPT_WINDOW);
                    if (filtered.length === 0) {
                        this.attempts.delete(uid);
                    } else {
                        this.attempts.set(uid, filtered);
                    }
                }
                // prune expired bans
                for (const [uid, until] of this.bannedUsers.entries()) {
                    if (now > until) {
                        this.bannedUsers.delete(uid);
                        Logger.info(`PromptFirewall: auto-unbanned ${uid}`);
                    }
                }
            }, intervalMs);

            Logger.info('PromptFirewall: started cleanup loop');
        } catch (e) {
            Logger.error('PromptFirewall: failed to start cleanup - ' + (e?.message || e));
        }
    }

    stopCleanup() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
            Logger.info('PromptFirewall: stopped cleanup loop');
        }
    }
}

module.exports = new PromptFirewall();
