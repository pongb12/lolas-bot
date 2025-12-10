class Logger {
    static colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    };

    static getTimestamp() {
        return new Date().toLocaleTimeString('vi-VN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static info(message, ...args) {
        console.log(`${this.colors.cyan}[${this.getTimestamp()}] ℹ️  INFO${this.colors.reset}: ${message}`, ...args);
    }

    static success(message, ...args) {
        console.log(`${this.colors.green}[${this.getTimestamp()}] ✅ SUCCESS${this.colors.reset}: ${message}`, ...args);
    }

    static warn(message, ...args) {
        console.log(`${this.colors.yellow}[${this.getTimestamp()}] ⚠️  WARN${this.colors.reset}: ${message}`, ...args);
    }

    static error(message, ...args) {
        console.log(`${this.colors.red}[${this.getTimestamp()}] ❌ ERROR${this.colors.reset}: ${message}`, ...args);
    }

    static debug(message, ...args) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`${this.colors.magenta}[${this.getTimestamp()}] 🐛 DEBUG${this.colors.reset}: ${message}`, ...args);
        }
    }

    static api(message, ...args) {
        console.log(`${this.colors.blue}[${this.getTimestamp()}] 🔌 API${this.colors.reset}: ${message}`, ...args);
    }
}

module.exports = Logger;
