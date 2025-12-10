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
        // Middleware cơ bản
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Health check endpoint (QUAN TRỌNG cho Render)
        this.app.get('/', (req, res) => {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            res.json({
                status: 'online',
                service: Config.BOT_NAME,
                version: Config.BOT_VERSION,
                model: Config.GEMINI_MODEL,
                uptime: `${hours}h ${minutes}m ${seconds}s`,
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: '/health',
                    ping: '/ping',
                    status: '/status'
                }
            });
        });
        
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                discord: this.bot ? 'connected' : 'disconnected',
                timestamp: Date.now()
            });
        });
        
        this.app.get('/ping', (req, res) => {
            res.json({ 
                ping: 'pong', 
                timestamp: Date.now(),
                server_time: new Date().toISOString()
            });
        });
        
        this.app.get('/status', (req, res) => {
            const status = {
                bot: {
                    name: Config.BOT_NAME,
                    version: Config.BOT_VERSION,
                    prefix: Config.PREFIX,
                    model: Config.GEMINI_MODEL,
                    env: Config.NODE_ENV
                },
                system: {
                    node_version: process.version,
                    platform: process.platform,
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                },
                discord: this.bot ? {
                    user: this.bot.client.user?.tag || 'unknown',
                    guilds: this.bot.client.guilds.cache.size,
                    ping: this.bot.client.ws.ping
                } : null
            };
            
            res.json(status);
        });
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ 
                error: 'Endpoint not found',
                available: ['/', '/health', '/ping', '/status']
            });
        });
    }
    
    setupProcessHandlers() {
        // Xử lý lỗi unhandled
        process.on('uncaughtException', (error) => {
            Logger.error('UNCAUGHT EXCEPTION:', error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
        });
        
        // Graceful shutdown
        const shutdown = async (signal) => {
            Logger.warn(`Nhận tín hiệu ${signal}, đang tắt ứng dụng...`);
            
            try {
                if (this.bot) {
                    await this.bot.stop();
                }
                
                if (this.server) {
                    this.server.close(() => {
                        Logger.success('HTTP server đã đóng');
                        process.exit(0);
                    });
                    
                    // Force shutdown sau 5s
                    setTimeout(() => {
                        Logger.error('Buộc tắt do timeout');
                        process.exit(1);
                    }, 5000);
                } else {
                    process.exit(0);
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
            // Khởi động web server
            this.server = this.app.listen(this.port, () => {
                Logger.success(`🌐 Web server chạy trên port ${this.port}`);
                Logger.success(`📊 Health check: http://localhost:${this.port}/health`);
                Logger.success(`🔄 Auto-ping để chống sleep: mỗi 5 phút`);
            });
            
            // Khởi động Discord bot
            Logger.info('🤖 Đang khởi động Discord bot...');
            this.bot = new DiscordBot();
            await this.bot.start();
            
            // Tự động ping để chống sleep (cho Render free tier)
            this.startAutoPing();
            
            Logger.success('🎉 Ứng dụng đã khởi động thành công!');
            
            return { server: this.server, bot: this.bot };
            
        } catch (error) {
            Logger.error('Lỗi khởi động ứng dụng:', error);
            
            // Đảm bảo dọn dẹp nếu có lỗi
            if (this.server) {
                this.server.close();
            }
            
            process.exit(1);
        }
    }
    
    startAutoPing() {
        // Tự động ping chính nó mỗi 5 phút để chống sleep
        if (Config.NODE_ENV === 'production') {
            const pingInterval = 5 * 60 * 1000; // 5 phút
            
            setInterval(async () => {
                try {
                    const response = await fetch(`http://localhost:${this.port}/health`);
                    if (response.ok) {
                        Logger.debug('✅ Auto-ping thành công');
                    }
                } catch (error) {
                    Logger.debug('🔄 Auto-ping (localhost không khả dụng trong production)');
                }
            }, pingInterval);
            
            Logger.info(`🔄 Đã bật auto-ping mỗi ${pingInterval / 1000 / 60} phút`);
        }
    }
}

// Khởi động ứng dụng
if (require.main === module) {
    const app = new Application();
    app.start().catch(error => {
        Logger.error('Lỗi không xác định:', error);
        process.exit(1);
    });
}

module.exports = Application;
