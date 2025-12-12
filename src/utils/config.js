const Logger = require('./logger');

class Config {
    constructor() {
        this.loadEnvironment();
        this.validate();
        this.printConfig();
    }

    loadEnvironment() {
        // Discord
        this.DISCORD_TOKEN = process.env.DISCORD_TOKEN;
        this.PREFIX = process.env.PREFIX || '.';
        this.OWNER_ID = process.env.OWNER_ID || '';
        this.SERVER_ID = process.env.SERVER_ID || '';
        
        // Groq API
        this.GROQ_API_KEY = process.env.GROQ_API_KEY;
        this.GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
        this.GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        
        // Private Chat Settings
        this.PRIVATE_CATEGORY_NAME = process.env.PRIVATE_CATEGORY_NAME || '🤖 Lol.AI Private Chats';
        this.PRIVATE_CHANNEL_TIMEOUT = parseInt(process.env.PRIVATE_CHANNEL_TIMEOUT) || 3600000; // 1 giờ
        this.MAX_PRIVATE_CHANNELS = parseInt(process.env.MAX_PRIVATE_CHANNELS) || 20;
        
        // Server
        this.PORT = process.env.PORT || 3000;
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        
        // Performance
        this.MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 1024;
        this.MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 10;
        this.COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS) || 2;
        
        // Bot info
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '7.0.0';
        this.BOT_DESCRIPTION = 'AI Assistant với Groq & Private Chat';
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
            Logger.error(`Thiếu biến môi trường: ${missing.join(', ')}`);
            if (this.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    }

    printConfig() {
        Logger.success(`${this.BOT_NAME} v${this.BOT_VERSION}`);
        Logger.info(`Môi trường: ${this.NODE_ENV}`);
        Logger.info(`Prefix: "${this.PREFIX}"`);
        Logger.info(`Model: ${this.GROQ_MODEL}`);
        Logger.info(`Server ID: ${this.SERVER_ID || 'Auto-detect'}`);
    }
}

module.exports = new Config();
