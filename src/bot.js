const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const BotConfig = require('./utils/config');
const Logger = require('./utils/logger');

class DiscordBot {
    constructor() {
        this.config = BotConfig;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ]
        });
        
        this.commands = new Collection();
        this.cooldowns = new Collection();
        
        this.loadCommands();
        this.setupEventHandlers();
    }
    
    loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('name' in command && 'execute' in command) {
                this.commands.set(command.name, command);
                Logger.success(`Đã load command: ${command.name}`);
            } else {
                Logger.warn(`Command ${file} thiếu thuộc tính cần thiết`);
            }
        }
    }
    
    setupEventHandlers() {
        // Ready event
        this.client.once('ready', () => {
            Logger.success(`✅ ${this.config.BOT_NAME} đã sẵn sàng!`);
            Logger.success(`✅ Tên: ${this.client.user.tag}`);
            Logger.success(`✅ ID: ${this.client.user.id}`);
            Logger.success(`✅ Servers: ${this.client.guilds.cache.size}`);
            Logger.success(`✅ Prefix: "${this.config.PREFIX}"`);
            
            // Set status
            this.client.user.setActivity({
                name: `${this.config.PREFIX}help để xem lệnh`,
                type: 0
            });
        });
        
        // Message event
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.content.startsWith(this.config.PREFIX)) return;
            
            const args = message.content.slice(this.config.PREFIX.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            const command = this.commands.get(commandName);
            if (!command) return;
            
            // Cooldown check
            if (!this.cooldowns.has(command.name)) {
                this.cooldowns.set(command.name, new Collection());
            }
            
            const now = Date.now();
            const timestamps = this.cooldowns.get(command.name);
            const cooldownAmount = 3000; // 3 seconds
            
            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return message.reply(`⏰ Chờ ${timeLeft.toFixed(1)}s trước khi dùng lại \`${this.config.PREFIX}${command.name}\``);
                }
            }
            
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
            
            // Execute command
            try {
                await command.execute(message, args);
            } catch (error) {
                Logger.error(`Command ${command.name} error:`, error);
                await message.reply('❌ Có lỗi xảy ra khi thực thi lệnh.');
            }
        });
        
        // Error handling
        this.client.on('error', (error) => {
            Logger.error('Discord client error:', error);
        });
    }
    
    async start() {
        try {
            await this.client.login(this.config.DISCORD_TOKEN);
            Logger.success('Bot đã đăng nhập thành công');
            return this.client;
        } catch (error) {
            Logger.error('Không thể đăng nhập bot:', error.message);
            throw error;
        }
    }
    
    async stop() {
        this.client.destroy();
        Logger.info('Bot đã dừng');
    }
}

module.exports = DiscordBot;
