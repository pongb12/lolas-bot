const Logger = require('./logger');

class BotConfig {
    constructor() {
        this.loadConfig();
        this.validate();
    }

    loadConfig() {
        // Load từ environment variables
        this.DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        this.PREFIX = process.env.PREFIX || '.';
        this.OWNER_ID = process.env.OWNER_ID || '';
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        this.PORT = process.env.PORT || 3000;
        
        // Bot info
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '3.0.0';
        this.BOT_DESCRIPTION = 'AI Assistant cho server Lol - Powered by Gemini';
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
            Logger.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
            
            if (this.NODE_ENV === 'production') {
                process.exit(1);
            } else {
                Logger.warn('⚠️ Chạy ở chế độ development với config thiếu');
            }
        } else {
            Logger.success('✅ Đã load config thành công');
        }
    }

    isDevelopment() {
        return this.NODE_ENV === 'development';
    }

    isProduction() {
        return this.NODE_ENV === 'production';
    }
}

// Export singleton instance
module.exports = new BotConfig();
