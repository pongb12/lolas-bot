const Logger = require('./logger');

class Config {
    constructor() {
        this.loadEnvironment();
        this.validate();
        this.printConfig();
    }

    loadEnvironment() {
        // Discord Configuration
        this.DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        this.PREFIX = process.env.PREFIX || '.';
        this.OWNER_ID = process.env.OWNER_ID || '1003323955693764748'; // Your Discord ID
        this.SERVER_ID = process.env.SERVER_ID || '';
        
        // Groq API Configuration
        this.GROQ_API_KEY = process.env.GROQ_API_KEY;
        this.GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
        this.GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        
        // Private Chat Settings
        this.PRIVATE_CATEGORY_NAME = process.env.PRIVATE_CATEGORY_NAME || '🤖 Lol.AI Private Chats';
        this.PRIVATE_CHANNEL_TIMEOUT = parseInt(process.env.PRIVATE_CHANNEL_TIMEOUT) || 3600000; // 1 giờ
        this.MAX_PRIVATE_CHANNELS = parseInt(process.env.MAX_PRIVATE_CHANNELS) || 20;
        
        // Server & Environment
        this.PORT = process.env.PORT || 3000;
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        
        // AI Performance Settings
        this.MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 1024;
        this.MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 10;
        this.COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS) || 2;
        
        // Security Configuration
        this.BAN_THRESHOLD = parseInt(process.env.BAN_THRESHOLD) || 5;
        this.BAN_DURATION = parseInt(process.env.BAN_DURATION) || 2678400000; // 1 giờ
        this.CACHE_DURATION = parseInt(process.env.CACHE_DURATION) || 30000; // 30 giây
        this.MAX_CACHE_SIZE = parseInt(process.env.MAX_CACHE_SIZE) || 200;
        
        // Bot Information
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '1.5.5';
        this.BOT_DESCRIPTION = 'AI Assistant với Groq';
        
        // Path Configuration
        this.RULES_PATH = 'rules.json';
        this.AUDIT_LOG_PATH = 'audit_log.json';
        this.OWNER_NOTIFICATIONS_PATH = 'owner_notifications.json';
        
        // Prompt Security Settings
        this.PROMPT_ENCODING_ENABLED = process.env.PROMPT_ENCODING_ENABLED === 'true' || true;
        this.AUTO_CLEANUP_INTERVAL = parseInt(process.env.AUTO_CLEANUP_INTERVAL) || 600000; // 10 phút
        this.HISTORY_EXPIRE_TIME = parseInt(process.env.HISTORY_EXPIRE_TIME) || 7200000; // 2 giờ
    }

    validate() {
        const required = ['DISCORD_TOKEN', 'GROQ_API_KEY'];
        const missing = [];

        for (const key of required) {
            if (!this[key]) {
                missing.push(key);
            }
        }

        if (missing.length > 0) {
            Logger.error(`❌ Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
            Logger.error('Vui lòng kiểm tra file .env hoặc cài đặt trên Render.com');
            
            if (this.NODE_ENV === 'production') {
                process.exit(1);
            } else {
                Logger.warn('⚠️  Đang chạy ở chế độ development với cấu hình thiếu...');
            }
        }
        
        // Validate OWNER_ID format
        if (!/^\d{17,20}$/.test(this.OWNER_ID)) {
            Logger.error(`❌ OWNER_ID không hợp lệ: ${this.OWNER_ID}`);
            Logger.error('OWNER_ID phải là Discord ID (17-20 chữ số)');
            
            if (this.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
        
        // Validate numeric configurations
        const numericConfigs = [
            { key: 'MAX_TOKENS', min: 100, max: 4000 },
            { key: 'MAX_HISTORY', min: 1, max: 50 },
            { key: 'BAN_THRESHOLD', min: 1, max: 20 },
            { key: 'BAN_DURATION', min: 60000, max: 86400000 } // 1 phút đến 24 giờ
        ];
        
        for (const config of numericConfigs) {
            const value = this[config.key];
            if (value < config.min || value > config.max) {
                Logger.warn(`⚠️  ${config.key}=${value} nằm ngoài khoảng khuyến nghị (${config.min}-${config.max})`);
            }
        }
    }

    printConfig() {
        Logger.success(`${this.BOT_NAME} v${this.BOT_VERSION}`);
        Logger.info('='.repeat(50));
        Logger.info(`🎮 Môi trường: ${this.NODE_ENV}`);
        Logger.info(`🤖 Prefix: "${this.PREFIX}"`);
        Logger.info(`🧠 Model: ${this.GROQ_MODEL}`);
        Logger.info(`👑 Owner ID: ${this.OWNER_ID}`);
        Logger.info(`🏠 Server ID: ${this.SERVER_ID || 'Auto-detect'}`);
        Logger.info(`💾 Cache: ${this.MAX_CACHE_SIZE} items, ${this.CACHE_DURATION}ms`);
        Logger.info(`🛡️  Bảo mật: Ban sau ${this.BAN_THRESHOLD} lần vi phạm (${this.BAN_DURATION/3600000} giờ)`);
        
        if (this.NODE_ENV === 'development') {
            Logger.info('📢 Cảnh báo: Đang chạy ở chế độ development!');
        }
        
        Logger.info('='.repeat(50));
    }
    
    // Helper methods
    isOwner(userId) {
        return userId === this.OWNER_ID;
    }
    
    getOwnerId() {
        return this.OWNER_ID;
    }
    
    getSecurityConfig() {
        return {
            banThreshold: this.BAN_THRESHOLD,
            banDuration: this.BAN_DURATION,
            cacheDuration: this.CACHE_DURATION,
            maxCacheSize: this.MAX_CACHE_SIZE
        };
    }
    
    getAIConfig() {
        return {
            model: this.GROQ_MODEL,
            maxTokens: this.MAX_TOKENS,
            maxHistory: this.MAX_HISTORY,
            apiUrl: this.GROQ_API_URL
        };
    }
}

module.exports = new Config();
