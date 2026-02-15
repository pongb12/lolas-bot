const path = require('path');
const fs = require('fs').promises;
const Logger = require('./logger');
const Config = require('./config');

class PromptFirewall {
    constructor() {
        this.classifier = null;
        this.isReady = false;
        
        // 1. Lớp lọc Heuristic (Regex) - Chặn cực nhanh các đòn tấn công lộ liễu
        this.criticalPatterns = [
            /ignore (all )?previous/i,
            /system (prompt|message|instruction)s?/i,
            /hãy in (toàn bộ )?prompt/i,
            /show (me )?the prompt/i,
            /dưới đây là các luật/i
        ];

        // 2. Danh sách trắng (Whitelist) - Không bao giờ chặn các câu này
        this.whitelist = [
            /máy bay/i, /thời tiết/i, /nấu ăn/i, /học tập/i
        ];

        this.attempts = new Map();
        this.bannedUsers = new Map();
        this.BAN_THRESHOLD = Config.BAN_THRESHOLD || 5;
        this.BAN_DURATION = Config.BAN_DURATION || 86400000;

        // Khởi tạo AI
        this.initAI();
    }

    async initAI() {
        try {
            // Import động để tiết kiệm RAM khi khởi động
            const { pipeline, env } = await import('@xenova/transformers');
            
            // Cấu hình để chạy mượt trên môi trường server
            env.allowLocalModels = false;
            env.useBrowserCache = false;

            this.classifier = await pipeline('text-classification', 'Xenova/llama-prompt-guard-2-86m');
            this.isReady = true;
            Logger.success('🧠 PromptFirewall: AI Model Loaded (Llama-86M)');
        } catch (e) {
            Logger.error('🧠 PromptFirewall: AI Load Failed: ' + e.message);
        }
    }

    /* ================= PHÂN TÍCH NỘI DUNG ================= */
    async analyzeContent(text) {
        if (!text || typeof text !== 'string') return { safe: true };

        const lowerText = text.toLowerCase();

        // Ưu tiên 1: Check Whitelist (Tránh chặn nhầm "máy bay")
        if (this.whitelist.some(p => p.test(lowerText))) {
            return { safe: true, reason: 'whitelist' };
        }

        // Ưu tiên 2: Check Regex Critical (Tấn công quá rõ ràng)
        if (this.criticalPatterns.some(p => p.test(lowerText))) {
            return { safe: false, reason: 'critical_regex', confidence: 1.0 };
        }

        // Ưu tiên 3: Dùng AI để phân tích ngữ cảnh (Phân biệt hỏi cấu tạo máy bay vs cấu tạo prompt)
        if (this.isReady) {
            try {
                const results = await this.classifier(text);
                // Model trả về nhãn 'INJECTION' hoặc 'JAILBREAK' nếu nguy hiểm
                const isAttack = results[0].label !== 'BENIGN';
                const score = results[0].score;

                if (isAttack && score > 0.85) { // Chỉ chặn khi AI chắc chắn trên 85%
                    return { safe: false, reason: 'ai_detected', confidence: score };
                }
            } catch (err) {
                Logger.error('AI Analysis Error: ' + err.message);
            }
        }

        return { safe: true };
    }

    /* ================= THEO DÕI & CHẶN ================= */
    async trackAttempt(userId, question) {
        // Owner Immunity
        if (userId === Config.OWNER_ID) return { allowed: true };
        
        // Kiểm tra ban
        if (this.isBanned(userId)) return { allowed: false, reason: 'banned' };

        const analysis = await this.analyzeContent(question);

        if (!analysis.safe) {
            Logger.warn(`🚨 Security: User ${userId} triggered ${analysis.reason} (${analysis.confidence})`);
            
            const now = Date.now();
            const userAttempts = this.attempts.get(userId) || [];
            const recentAttempts = userAttempts.filter(t => now - t < 600000); // 10 phút
            
            recentAttempts.push(now);
            this.attempts.set(userId, recentAttempts);

            if (recentAttempts.length >= this.BAN_THRESHOLD) {
                this.banUser(userId);
                return { allowed: false, reason: 'banned' };
            }

            return { allowed: false, reason: 'warning' };
        }

        return { allowed: true };
    }

    banUser(userId) {
        const banUntil = Date.now() + this.BAN_DURATION;
        this.bannedUsers.set(userId, banUntil);
        Logger.error(`🚫 User ${userId} has been banned for 24h due to prompt injection attempts.`);
    }

    isBanned(userId) {
        const banUntil = this.bannedUsers.get(userId);
        if (!banUntil) return false;
        if (Date.now() > banUntil) {
            this.bannedUsers.delete(userId);
            return false;
        }
        return true;
    }
}

module.exports = new PromptFirewall();
