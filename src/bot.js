const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class DiscordBot {
    constructor() {
        this.config = Config;
        
        // FIX LỖI: Đã xóa GatewayIntentBits.MessageTyping
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                // ĐÃ XÓA: GatewayIntentBits.MessageTyping (gây lỗi)
            ],
            partials: [], // Thêm nếu cần
            restTimeOffset: 0,
            failIfNotExists: false,
        });
        
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.rateLimits = new Map();
        
        this.loadCommands();
        this.setupEventHandlers();
    }
    
    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        
        try {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                
                if ('name' in command && 'execute' in command) {
                    this.commands.set(command.name, command);
                    Logger.success(`Đã load command: ${command.name}`);
                }
            }
            
            Logger.info(`Tổng số commands: ${this.commands.size}`);
        } catch (error) {
            Logger.error('Lỗi load commands:', error);
        }
    }
    
    setupEventHandlers() {
        // Ready event
        this.client.once('ready', () => {
            Logger.success(`✅ ${this.config.BOT_NAME} đã online!`);
            Logger.success(`👉 Tag: ${this.client.user.tag}`);
            Logger.success(`👉 ID: ${this.client.user.id}`);
            Logger.success(`👉 Servers: ${this.client.guilds.cache.size}`);
            Logger.success(`👉 Prefix: "${this.config.PREFIX}"`);
            Logger.success(`👉 AI Engine: DeepSeek`);
            
            // Set status
            this.client.user.setPresence({
                activities: [{
                    name: `${this.config.PREFIX}help để xem lệnh`,
                    type: 0 // PLAYING
                }],
                status: 'online'
            });
        });
        
        // Message event
        this.client.on('messageCreate', async (message) => {
            // Bỏ qua nếu là bot hoặc không có prefix
            if (message.author.bot || !message.content.startsWith(this.config.PREFIX)) return;
            
            const args = message.content.slice(this.config.PREFIX.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            const command = this.commands.get(commandName);
            if (!command) return;
            
            // Rate limiting per user
            const userId = message.author.id;
            const now = Date.now();
            const userLimits = this.rateLimits.get(userId) || { count: 0, resetTime: now + 60000 };
            
            if (now > userLimits.resetTime) {
                userLimits.count = 0;
                userLimits.resetTime = now + 60000;
            }
            
            if (userLimits.count >= 15) { // Tối đa 15 lệnh/phút
                await message.reply('⏰ **Bạn đang gửi lệnh quá nhanh!** Vui lòng chờ 1 phút.');
                return;
            }
            
            userLimits.count++;
            this.rateLimits.set(userId, userLimits);
            
            // Cooldown per command
            if (!this.cooldowns.has(command.name)) {
                this.cooldowns.set(command.name, new Collection());
            }
            
            const timestamps = this.cooldowns.get(command.name);
            const cooldownAmount = (command.cooldown || this.config.COOLDOWN_SECONDS) * 1000;
            
            if (timestamps.has(userId)) {
                const expirationTime = timestamps.get(userId) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    const reply = await message.reply(
                        `⏰ Chờ ${timeLeft.toFixed(1)}s trước khi dùng lại \`${this.config.PREFIX}${command.name}\``
                    );
                    setTimeout(() => reply.delete().catch(() => {}), 3000);
                    return;
                }
            }
            
            timestamps.set(userId, now);
            setTimeout(() => timestamps.delete(userId), cooldownAmount);
            
            // Thực thi command
            try {
                await command.execute(message, args);
            } catch (error) {
                Logger.error(`Lỗi command ${command.name}:`, error);
                await message.reply('❌ Có lỗi xảy ra khi thực thi lệnh. Vui lòng thử lại!');
            }
        });
        
        // Error handling
        this.client.on('error', (error) => {
            Logger.error('Lỗi Discord client:', error.message);
        });
        
        this.client.on('warn', (warning) => {
            Logger.warn('Cảnh báo Discord:', warning);
        });
        
        this.client.on('disconnect', () => {
            Logger.warn('Bot đã ngắt kết nối, đang thử kết nối lại...');
        });
        
        this.client.on('reconnecting', () => {
            Logger.info('Đang kết nối lại Discord...');
        });
    }
    
    async start() {
        try {
            Logger.info('Đang kết nối Discord...');
            await this.client.login(this.config.DISCORD_TOKEN);
            Logger.success('Bot đã đăng nhập thành công');
            return this.client;
        } catch (error) {
            Logger.error('Lỗi đăng nhập Discord:', error.message);
            
            // Gợi ý fix lỗi
            if (error.message.includes('token')) {
                Logger.error('👉 KIỂM TRA: DISCORD_TOKEN trong biến môi trường');
                Logger.error('👉 KIỂM TRA: Bot đã được mời vào server chưa?');
                Logger.error('👉 KIỂM TRA: Message Content Intent đã bật chưa?');
            }
            
            throw error;
        }
    }
    
    async stop() {
        Logger.info('Đang dừng bot...');
        this.client.destroy();
        Logger.success('Bot đã dừng');
    }
}

module.exports = DiscordBot;
