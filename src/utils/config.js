const Logger = require('./logger');

class Config {
    constructor() {
        this.loadEnvironment();
        this.validate();
        this.printConfig();
    }

    loadEnvironment() {
        // Core configuration
        this.DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        this.PREFIX = process.env.PREFIX || '.';
        this.OWNER_ID = process.env.OWNER_ID || '';
        
        // Server configuration
        this.PORT = process.env.PORT || 3000;
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        
        // Gemini configuration - Tối ưu tốc độ
        this.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // Model nhanh nhất
        this.MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 1024; // Giảm để tăng tốc
        this.TEMPERATURE = parseFloat(process.env.TEMPERATURE) || 0.7;
        
        // Bot information
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '4.0.0';
        this.BOT_DESCRIPTION = 'AI Assistant siêu tốc với Gemini';
        
        // Performance settings
        this.MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 5; // Giảm lịch sử để tăng tốc
        this.COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS) || 2;
    }

    validate() {
        const required = ['DISCORD_TOKEN', 'GEMINI_API_KEY'];
        const missing = [];

        for (const key of required) {
            if (!this[key]) {
                missing.push(key);
            }
        }

        if (missing.length > 0) {
            Logger.error(`Thiếu biến môi trường: ${missing.join(', ')}`);
            
            if (this.NODE_ENV === 'production') {
                Logger.error('Không thể khởi động trong môi trường production');
                process.exit(1);
            } else {
                Logger.warn('Chạy ở chế độ development với config thiếu');
            }
        }
    }

    printConfig() {
        Logger.success(`Cấu hình ${this.BOT_NAME} v${this.BOT_VERSION}`);
        Logger.info(`Môi trường: ${this.NODE_ENV}`);
        Logger.info(`Prefix: "${this.PREFIX}"`);
        Logger.info(`Model Gemini: ${this.GEMINI_MODEL}`);
        Logger.info(`Max tokens: ${this.MAX_TOKENS}`);
        Logger.info(`Max history: ${this.MAX_HISTORY}`);
        
        // Mask API key for security
        const maskedKey = this.GEMINI_API_KEY 
            ? `${this.GEMINI_API_KEY.substring(0, 10)}...${this.GEMINI_API_KEY.substring(this.GEMINI_API_KEY.length - 4)}`
            : 'CHƯA CẤU HÌNH';
        Logger.debug(`Gemini API Key: ${maskedKey}`);
    }

    isDevelopment() {
        return this.NODE_ENV === 'development';
    }

    isProduction() {
        return this.NODE_ENV === 'production';
    }
}

module.exports = new Config();
