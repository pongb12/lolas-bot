const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Config = require('./utils/config');
const Logger = require('./utils/logger');
const PrivateChatManager = require('./privateManager');

class DiscordBot {
    constructor() {
        this.config = Config;
        
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.rateLimits = new Map();
        this.privateManager = new PrivateChatManager();
        
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
        this.client.once(Events.ClientReady, () => {
            Logger.success(`✅ ${this.config.BOT_NAME} đã online!`);
            Logger.success(`👉 Tag: ${this.client.user.tag}`);
            Logger.success(`👉 ID: ${this.client.user.id}`);
            Logger.success(`👉 Servers: ${this.client.guilds.cache.size}`);
            Logger.success(`👉 Prefix: "${this.config.PREFIX}"`);
            Logger.success(`👉 Model: ${this.config.GROQ_MODEL}`);
            Logger.success(`👉 Private Channels: ${this.privateManager.privateChannels.size}`);
            
            // Set status
            this.client.user.setPresence({
                activities: [{
                    name: `${this.config.PREFIX}help để xem lệnh`,
                    type: 0
                }],
                status: 'online'
            });
        });
        
        // Message event (public channels)
        this.client.on(Events.MessageCreate, async (message) => {
            // Bỏ qua nếu là bot
            if (message.author.bot) return;
            
            // Xử lý private channels
            const privateData = this.privateManager.getPrivateChannel(message.author.id);
            if (privateData && message.channel.id === privateData.channelId) {
                await this.handlePrivateMessage(message);
                return;
            }
            
            // Xử lý commands trong public channels
            if (!message.content.startsWith(this.config.PREFIX)) return;
            
            await this.handleCommand(message);
        });
        
        // Error handling
        this.client.on(Events.Error, (error) => {
            Logger.error('Lỗi Discord client:', error.message);
        });
        
        this.client.on(Events.Warn, (warning) => {
            Logger.warn('Cảnh báo Discord:', warning);
        });
    }
    
    async handlePrivateMessage(message) {
        try {
            // Cập nhật hoạt động
            this.privateManager.updateActivity(message.author.id);
            
            // Hiển thị typing
            message.channel.sendTyping();
            
            // Xử lý tin nhắn trong private chat
            const ai = require('./ai');
            const response = await ai.askPrivate(message.author.id, message.content);
            
            // Gửi response
            await message.channel.send({
                content: response,
                reply: { messageReference: message.id }
            });
            
        } catch (error) {
            Logger.error('Lỗi private message:', error);
            await message.channel.send('❌ Đã xảy ra lỗi. Vui lòng thử lại!');
        }
    }
    
    async handleCommand(message) {
        const args = message.content.slice(this.config.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        const command = this.commands.get(commandName);
        if (!command) return;
        
        // Rate limiting
        const userId = message.author.id;
        const now = Date.now();
        const userLimits = this.rateLimits.get(userId) || { count: 0, resetTime: now + 60000 };
        
        if (now > userLimits.resetTime) {
            userLimits.count = 0;
            userLimits.resetTime = now + 60000;
        }
        
        if (userLimits.count >= 15) {
            await message.reply('⏰ **Bạn đang gửi lệnh quá nhanh!** Vui lòng chờ 1 phút.');
            return;
        }
        
        userLimits.count++;
        this.rateLimits.set(userId, userLimits);
        
        // Cooldown
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
        
        // Execute command
        try {
            await command.execute(message, args, {
                bot: this,
                privateManager: this.privateManager
            });
        } catch (error) {
            Logger.error(`Lỗi command ${command.name}:`, error);
            await message.reply('❌ Có lỗi xảy ra khi thực thi lệnh. Vui lòng thử lại!');
        }
    }
    
    async start() {
        try {
            Logger.info('Đang kết nối Discord...');
            await this.client.login(this.config.DISCORD_TOKEN);
            Logger.success('Bot đã đăng nhập thành công');
            return this.client;
        } catch (error) {
            Logger.error('Lỗi đăng nhập Discord:', error.message);
            throw error;
        }
    }
    
    async stop() {
        Logger.info('Đang dừng bot...');
        this.privateManager.stopCleanup();
        this.client.destroy();
        Logger.success('Bot đã dừng');
    }
}

module.exports = DiscordBot;
