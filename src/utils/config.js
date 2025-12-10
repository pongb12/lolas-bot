// src/utils/config.js
const Logger = require('./logger');

class Config {
    constructor() {
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '2.0.0';
        this.BOT_DESCRIPTION = 'AI assistant cho server Lol!!!';
        
        this.loadFromEnvironment();
        this.validate();
    }
    
    loadFromEnvironment() {
        // Load từ process.env (GitHub Secrets/Railway sẽ inject vào đây)
        this.DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        this.PREFIX = process.env.PREFIX || '.';
        this.OWNER_ID = process.env.OWNER_ID || '';
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        
        // Railway specific
        this.PORT = process.env.PORT || 3000;
        this.RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT || 'production';
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
            Logger.error('❌ THIẾU BIẾN MÔI TRƯỜNG:', missing.join(', '));
            Logger.error('Vui lòng thêm các biến này vào GitHub Secrets hoặc Railway Variables');
            
            // Chỉ exit nếu không phải development
            if (this.NODE_ENV !== 'development') {
                process.exit(1);
            } else {
                Logger.warn('⚠️ Đang chạy ở chế độ development, có thể thiếu biến môi trường');
            }
        } else {
            Logger.success('✅ Đã load tất cả biến môi trường cần thiết');
        }
    }
    
    // Helper để kiểm tra mode
    isDevelopment() {
        return this.NODE_ENV === 'development';
    }
    
    isProduction() {
        return this.NODE_ENV === 'production';
    }
}

module.exports = new Config();
