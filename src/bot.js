// bot.js
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
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
            ],
            partials: ['CHANNEL', 'MESSAGE', 'USER']
        });
        
        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.rateLimits = new Map();
        this.privateManager = new PrivateChatManager();
        
        // gán một vài property để tiện truy cập từ các module khác
        this.client.botInstance = this;
        this.client.privateManager = this.privateManager;
        this.client.commands = this.commands;

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
                } else {
                    Logger.warn(`File command ${file} thiếu thuộc tính name hoặc execute`);
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
            try {
              this.client.user.setPresence({
                  activities: [{
                      name: `${this.config.PREFIX}help để xem lệnh`,
                      type: 0
                  }],
                  status: 'online'
              });
            } catch (err) {
              Logger.warn('Không thể set presence:', err.message);
            }

            // start cleanup
            this.privateManager.startCleanup(this.client);
        });
        
        // Message event (public channels + DMs)
        this.client.on(Events.MessageCreate, async (message) => {
            // Bỏ qua nếu là bot
            if (message.author.bot) return;
            
            // Xử lý private channels (nếu sử dụng channel trong guild làm kênh private)
            const privateData = this.privateManager.getPrivateChannel(message.author.id);
            if (privateData && message.channel.id === privateData.channelId) {
                await this.handlePrivateMessage(message);
                return;
            }
            
            // Nếu là DM (direct message) và bạn muốn bot trả lời
            if (message.channel.type === 1 /* DM */ || message.channel.isDMBased && message.channel.type === 'DM') {
                // Bạn có thể xử lý DM riêng ở đây hoặc chuyển qua privateManager
                await this.handlePrivateMessage(message);
                return;
            }

            // Xử lý commands trong public channels
            if (!message.content.startsWith(this.config.PREFIX)) return;
            
            await this.handleCommand(message);
        });
        
        // Interaction event (for buttons, modals, slash commands, etc.)
        this.client.on(Events.InteractionCreate, async (interaction) => {
            await this.handleInteraction(interaction);
        });
        
        // Error handling
        this.client.on(Events.Error, (error) => {
            Logger.error('Lỗi Discord client:', error?.message || error);
        });
        
        this.client.on(Events.Warn, (warning) => {
            Logger.warn('Cảnh báo Discord:', warning);
        });
    }
    
    async handleInteraction(interaction) {
        try {
            // Modal submit
            if (interaction.isModalSubmit && interaction.isModalSubmit()) {
                // Defer reply nếu chưa
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }
                
                if (interaction.customId && interaction.customId.startsWith('feedback_modal_')) {
                    const feedbackCommand = this.commands.get('feedbacks');
                    if (feedbackCommand && typeof feedbackCommand.handleModalSubmit === 'function') {
                        await feedbackCommand.handleModalSubmit(interaction);
                        return;
                    } else {
                        await interaction.editReply({ content: 'Handler feedback không tìm thấy.' }).catch(() => {});
                        return;
                    }
                }
            }

            if (interaction.isButton && interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
                return;
            }

            if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
                const command = this.commands.get(interaction.commandName);
                if (command) {
                    await command.execute(interaction);
                }
            }
        } catch (error) {
            Logger.error('Lỗi trong handleInteraction:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: '❌ Lỗi khi xử lý tương tác' }).catch(() => {});
                } else {
                    await interaction.reply({ content: '❌ Lỗi khi xử lý tương tác', ephemeral: true }).catch(() => {});
                }
            } catch (err) {
                Logger.error('Không thể báo lỗi tương tác:', err);
            }
        }
    }
    
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        if (!customId) return;
        // xử lý buttons liên quan đến appeal (theo mẫu bạn có)
        if (customId.startsWith('approve_appeal_') || customId.startsWith('deny_appeal_') || customId.startsWith('ignore_appeal_')) {
            await this.handleAppealButton(interaction);
            return;
        }
    }
    
    async handleAppealButton(interaction) {
        // Implementation giống như bạn đã có: gọi ai.unblockUser etc.
        // Để giữ ngắn gọn, ta delegate cho ai.js
        const ai = require('./ai');
        const customId = interaction.customId;
        const userId = customId.split('_').pop();
        try {
            await interaction.deferReply();
            const user = await this.client.users.fetch(userId).catch(() => null);
            const userTag = user ? user.tag : `Unknown (${userId})`;

            if (customId.startsWith('approve_appeal_')) {
                ai.unblockUser(userId);
                if (user) {
                    await user.send({ content: '✅ Kháng cáo của bạn đã được chấp nhận.' }).catch(() => {});
                }
                await interaction.editReply({ content: `✅ Đã chấp nhận kháng cáo của ${userTag}` });
                if (interaction.message) await interaction.message.edit({ components: [] }).catch(()=>{});
            } else if (customId.startsWith('deny_appeal_')) {
                if (user) {
                    await user.send({ content: '❌ Kháng cáo của bạn đã bị từ chối.' }).catch(() => {});
                }
                await interaction.editReply({ content: `❌ Đã từ chối kháng cáo của ${userTag}` });
                if (interaction.message) await interaction.message.edit({ components: [] }).catch(()=>{});
            } else if (customId.startsWith('ignore_appeal_')) {
                await interaction.editReply({ content: `⏰ Đã đánh dấu xem sau kháng cáo của ${userTag}` });
            }
        } catch (err) {
            Logger.error('Lỗi khi xử lý appeal button:', err);
            try { await interaction.editReply({ content: '❌ Lỗi khi xử lý kháng cáo' }); } catch(e){}
        }
    }
    
    async handlePrivateMessage(message) {
        try {
            // Cập nhật activity để manager giữ kênh không bị xóa
            this.privateManager.updateActivity(message.author.id);
            
            // Hiển thị typing
            message.channel.sendTyping().catch(()=>{});
            
            const ai = require('./ai');
            const response = await ai.askPrivate(message.author.id, message.content);
            
            // Gửi response
            await message.channel.send({
                content: response
            }).catch(() => {});
            
        } catch (error) {
            Logger.error('Lỗi private message:', error);
            try { await message.channel.send('❌ Đã xảy ra lỗi. Vui lòng thử lại!'); } catch(e){}
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
        try { await this.client.destroy(); } catch(e){}
        Logger.success('Bot đã dừng');
    }
}

module.exports = DiscordBot;
