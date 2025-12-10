const express = require('express');
const DiscordBot = require('./bot');
const BotConfig = require('./utils/config');
const Logger = require('./utils/logger');

class Application {
    constructor() {
        this.app = express();
        this.port = BotConfig.PORT;
        this.bot = new DiscordBot();
        this.setupServer();
    }
    
    setupServer() {
        // Basic middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Health check endpoint (bắt buộc cho Render)
        this.app.get('/', (req, res) => {
            res.json({
                status: 'online',
                service: 'Lol.AI Discord Bot',
                version: BotConfig.BOT_VERSION,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });
        
        this.app.get('/ping', (req, res) => {
            res.json({ ping: 'pong', timestamp: Date.now() });
        });
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
    }
    
    async start() {
        // Start web server
        const server = this.app.listen(this.port, () => {
            Logger.success(`🌐 Web server chạy trên port ${this.port}`);
            Logger.success(`📊 Health check: http://localhost:${this.port}/health`);
        });
        
        // Start Discord bot
        try {
            await this.bot.start();
        } catch (error) {
            Logger.error('Không thể khởi động bot:', error);
            process.exit(1);
        }
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            Logger.info('🛑 Nhận SIGTERM, đang tắt...');
            this.shutdown(server);
        });
        
        process.on('SIGINT', () => {
            Logger.info('🛑 Nhận SIGINT, đang tắt...');
            this.shutdown(server);
        });
        
        return { server, bot: this.bot };
    }
    
    async shutdown(server) {
        try {
            await this.bot.stop();
            server.close(() => {
                Logger.info('✅ Server đã tắt');
                process.exit(0);
            });
        } catch (error) {
            Logger.error('Lỗi khi tắt:', error);
            process.exit(1);
        }
    }
}

// Start application
if (require.main === module) {
    const app = new Application();
    app.start().catch(error => {
        Logger.error('Lỗi khởi động ứng dụng:', error);
        process.exit(1);
    });
}

module.exports = Application;
