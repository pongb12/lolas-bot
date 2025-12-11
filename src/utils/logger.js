class Logger {
    static colors = {
        reset: '\x1b[0m',
        info: '\x1b[36m',
        success: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        api: '\x1b[34m'
    };

    static getTimestamp() {
        return new Date().toLocaleTimeString('vi-VN');
    }

    static log(level, message, ...args) {
        const color = this.colors[level] || this.colors.reset;
        console.log(`${color}[${this.getTimestamp()}] ${message}${this.colors.reset}`, ...args);
    }

    static info(message, ...args) { this.log('info', `ℹ️  INFO: ${message}`, ...args); }
    static success(message, ...args) { this.log('success', `✅ SUCCESS: ${message}`, ...args); }
    static warn(message, ...args) { this.log('warn', `⚠️  WARN: ${message}`, ...args); }
    static error(message, ...args) { this.log('error', `❌ ERROR: ${message}`, ...args); }
    static api(message, ...args) { this.log('api', `🔌 API: ${message}`, ...args); }
}

module.exports = Logger;
