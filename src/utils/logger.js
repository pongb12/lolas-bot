class Logger {
    static getTimestamp() {
        return new Date().toLocaleTimeString('vi-VN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static info(message, ...args) {
        console.log(`\x1b[36m[${this.getTimestamp()}] ℹ️  INFO\x1b[0m ${message}`, ...args);
    }

    static success(message, ...args) {
        console.log(`\x1b[32m[${this.getTimestamp()}] ✅ SUCCESS\x1b[0m ${message}`, ...args);
    }

    static warn(message, ...args) {
        console.log(`\x1b[33m[${this.getTimestamp()}] ⚠️  WARN\x1b[0m ${message}`, ...args);
    }

    static error(message, ...args) {
        console.log(`\x1b[31m[${this.getTimestamp()}] ❌ ERROR\x1b[0m ${message}`, ...args);
    }

    static api(message, ...args) {
        console.log(`\x1b[34m[${this.getTimestamp()}] 🔌 API\x1b[0m ${message}`, ...args);
    }
}

module.exports = Logger;
