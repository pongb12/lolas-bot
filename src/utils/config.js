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
        
        // DeepSeek API
        this.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        this.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        this.DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
        
        // Server
        this.PORT = process.env.PORT || 3000;
        this.NODE_ENV = process.env.NODE_ENV || 'production';
        
        // Performance
        this.MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 1024;
        this.MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 5;
        this.COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS) || 2;
        
        // Bot info
        this.BOT_NAME = 'Lol.AI';
        this.BOT_VERSION = '6.0.0';
        this.BOT_DESCRIPTION = 'AI Assistant với DeepSeek API';
    }

    validate() {
        const required = ['DISCORD_TOKEN', 'DEEPSEEK_API_KEY'];
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
        Logger.info(`Model: ${this.DEEPSEEK_MODEL}`);
        Logger.info(`API: ${this.DEEPSEEK_API_URL}`);
    }
}

module.exports = new Config();
