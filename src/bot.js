const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class DiscordBot {
    constructor() {
        this.config = Config;
        
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
            
        } catch (error) {
            Logger.error('Lỗi load commands:', error);
        }
    }
    
    setupEventHandlers() {
        this.client.once('ready', () => {
            Logger.success(`✅ ${this.config.BOT_NAME} đã online!`);
            Logger.success(`👉 Tag: ${this.client.user.tag}`);
            Logger.success(`👉 Servers: ${this.client.guilds.cache.size}`);
            Logger.success(`👉 Prefix: "${this.config.PREFIX}"`);
            Logger.success(`👉 Model: ${this.config.GEMINI_MODEL}`);
            
            this.client.user.setActivity({
                name: `${this.config.PREFIX}help để xem lệnh`,
                type: 0
            });
        });
        
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.content.startsWith(this.config.PREFIX)) return;
            
            const args = message.content.slice(this.config.PREFIX.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            const command = this.commands.get(commandName);
            if (!command) return;
            
            if (!this.cooldowns.has(command.name)) {
                this.cooldowns.set(command.name, new Collection());
            }
            
            const now = Date.now();
            const timestamps = this.cooldowns.get(command.name);
            const cooldownAmount = (command.cooldown || 3) * 1000;
            
            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    const reply = await message.reply(
                        `⏰ Chờ ${timeLeft.toFixed(1)}s trước khi dùng lại \`${this.config.PREFIX}${command.name}\``
                    );
                    setTimeout(() => reply.delete().catch(() => {}), 3000);
                    return;
                }
            }
            
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
            
            try {
                await command.execute(message, args);
            } catch (error) {
                Logger.error(`Lỗi command ${command.name}:`, error);
                await message.reply('❌ Có lỗi xảy ra. Vui lòng thử lại!');
            }
        });
        
        this.client.on('error', (error) => {
            Logger.error('Lỗi Discord:', error.message);
        });
    }
    
    async start() {
        try {
            await this.client.login(this.config.DISCORD_TOKEN);
            return this.client;
        } catch (error) {
            Logger.error('Lỗi đăng nhập Discord:', error.message);
            throw error;
        }
    }
}

module.exports = DiscordBot;
