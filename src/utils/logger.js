class Logger {
    static log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[36m', // Cyan
            success: '\x1b[32m', // Green
            warn: '\x1b[33m', // Yellow
            error: '\x1b[31m', // Red
            debug: '\x1b[35m' // Magenta
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || '\x1b[37m'; // White
        
        console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`, ...args);
    }
    
    static info(message, ...args) {
        this.log('info', message, ...args);
    }
    
    static success(message, ...args) {
        this.log('success', message, ...args);
    }
    
    static warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    
    static error(message, ...args) {
        this.log('error', message, ...args);
    }
    
    static debug(message, ...args) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, ...args);
        }
    }
}

module.exports = Logger;
