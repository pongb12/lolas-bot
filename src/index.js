const express = require('express');
const DiscordBot = require('./bot');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class Application {
    constructor() {
        this.app = express();
        this.port = Config.PORT;
        this.bot = null;
        this.server = null;
        
        this.setupExpress();
        this.setupProcessHandlers();
    }
    
    setupExpress() {
        this.app.use(express.json());
        
        // Health check
        this.app.get('/', (req, res) => {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            res.json({
                status: 'online',
                service: Config.BOT_NAME,
                version: Config.BOT_VERSION,
                ai_engine: 'DeepSeek',
                uptime: `${hours}h ${minutes}m ${seconds}s`,
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'healthy', timestamp: Date.now() });
        });
        
        this.app.get('/ping', (req, res) => {
            res.json({ ping: 'pong', timestamp: Date.now() });
        });
        
        // 404
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
    }
    
    setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            Logger.error('UNCAUGHT EXCEPTION:', error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error('UNHANDLED REJECTION:', reason);
        });
        
        // Graceful shutdown
        const shutdown = async (signal) => {
            Logger.warn(`Nhận ${signal}, đang tắt...`);
            
            try {
                if (this.server) {
                    this.server.close(() => {
                        Logger.success('HTTP server đã đóng');
                        process.exit(0);
                    });
                    
                    setTimeout(() => {
                        Logger.error('Buộc tắt do timeout');
                        process.exit(1);
                    }, 5000);
                }
            } catch (error) {
                Logger.error('Lỗi khi tắt:', error);
                process.exit(1);
            }
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    
    async start() {
        try {
            // Start web server
            this.server = this.app.listen(this.port, () => {
                Logger.success(`🌐 Web server chạy trên port ${this.port}`);
                Logger.success(`📊 Health check: http://localhost:${this.port}/health`);
            });
            
            // Start Discord bot
            Logger.info('🤖 Đang khởi động Discord bot...');
            this.bot = new DiscordBot();
            await this.bot.start();
            
            Logger.success('🎉 Ứng dụng đã khởi động thành công!');
            
            return { server: this.server, bot: this.bot };
            
        } catch (error) {
            Logger.error('Lỗi khởi động ứng dụng:', error);
            
            if (this.server) {
                this.server.close();
            }
            
            process.exit(1);
        }
    }
}

// Khởi động
if (require.main === module) {
    const app = new Application();
    app.start().catch(error => {
        Logger.error('Lỗi không xác định:', error);
        process.exit(1);
    });
}

module.exports = Application;
