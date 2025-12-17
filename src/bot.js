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
        
        // Interaction event (for buttons, slash commands, etc.)
        this.client.on(Events.InteractionCreate, async (interaction) => {
            await this.handleInteraction(interaction);
        });
        
        // Error handling
        this.client.on(Events.Error, (error) => {
            Logger.error('Lỗi Discord client:', error.message);
        });
        
        this.client.on(Events.Warn, (warning) => {
            Logger.warn('Cảnh báo Discord:', warning);
        });
    }
    
    async handleInteraction(interaction) {
        // Xử lý button interactions
        if (interaction.isButton()) {
            await this.handleButtonInteraction(interaction);
            return;
        }
        
        // Có thể thêm xử lý cho slash commands, select menus, etc. ở đây
    }
    
    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        
        // Xử lý appeal buttons
        if (customId.startsWith('approve_appeal_') || 
            customId.startsWith('deny_appeal_') || 
            customId.startsWith('ignore_appeal_')) {
            await this.handleAppealButton(interaction);
            return;
        }
        
        // Có thể thêm xử lý cho các buttons khác ở đây
    }
    
    async handleAppealButton(interaction) {
        const customId = interaction.customId;
        
        // Chỉ owner mới được xử lý
        if (interaction.user.id !== this.config.OWNER_ID) {
            return interaction.reply({
                content: '❌ Chỉ chủ bot mới có thể sử dụng chức năng này!',
                ephemeral: true
            });
        }
        
        // Lấy userId từ customId
        const userId = customId.split('_').pop();
        
        try {
            // Defer reply để tránh timeout
            await interaction.deferReply();
            
            // Lấy thông tin user
            const user = await this.client.users.fetch(userId).catch(() => null);
            const userTag = user ? user.tag : `Unknown User (${userId})`;
            
            const ai = require('./ai');
            
            if (customId.startsWith('approve_appeal_')) {
                // CHẤP NHẬN kháng cáo
                
                // Gỡ chặn user
                ai.unblockUser(userId);
                
                // Gửi thông báo cho user
                if (user) {
                    const userEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Kháng cáo được chấp nhận')
                        .setDescription('Chúc mừng! Kháng cáo của bạn đã được chấp nhận.')
                        .addFields(
                            { name: '🎉 Trạng thái', value: 'Tài khoản của bạn đã được **GỠ CHẶN**' },
                            { name: '✨ Lưu ý', value: 'Vui lòng tuân thủ quy định để tránh bị chặn lại.' },
                            { name: '📝 Thời gian xử lý', value: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }
                        )
                        .setTimestamp();
                    
                    await user.send({ embeds: [userEmbed] }).catch((err) => {
                        Logger.warn(`Không thể gửi DM cho user ${userId}:`, err.message);
                    });
                }
                
                // Cập nhật message của owner
                const ownerEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ ĐÃ CHẤP NHẬN KHÁNG CÁO')
                    .setDescription(`User **${userTag}** đã được gỡ chặn!`)
                    .addFields(
                        { name: '👤 User', value: `${userTag} (ID: \`${userId}\`)` },
                        { name: '⚡ Hành động', value: 'Đã gỡ chặn thành công' },
                        { name: '👨‍💼 Xử lý bởi', value: interaction.user.tag },
                        { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }
                    )
                    .setTimestamp();
                
                await interaction.editReply({ 
                    content: '✅ Đã chấp nhận kháng cáo!',
                    embeds: [ownerEmbed]
                });
                
                // Disable buttons
                await interaction.message.edit({ components: [] });
                
                Logger.info(`APPEAL APPROVED: ${userTag} (${userId}) đã được gỡ chặn bởi ${interaction.user.tag}`);
                
            } else if (customId.startsWith('deny_appeal_')) {
                // TỪ CHỐI kháng cáo
                
                // Gửi thông báo cho user
                if (user) {
                    const userEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Kháng cáo bị từ chối')
                        .setDescription('Rất tiếc, kháng cáo của bạn đã bị từ chối.')
                        .addFields(
                            { name: '⛔ Trạng thái', value: 'Tài khoản của bạn vẫn **BỊ CHẶN**' },
                            { name: '📞 Hỗ trợ', value: `Nếu bạn có thắc mắc, vui lòng liên hệ: <@${this.config.OWNER_ID}>` },
                            { name: '📝 Thời gian xử lý', value: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }
                        )
                        .setTimestamp();
                    
                    await user.send({ embeds: [userEmbed] }).catch((err) => {
                        Logger.warn(`Không thể gửi DM cho user ${userId}:`, err.message);
                    });
                }
                
                // Cập nhật message của owner
                const ownerEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ ĐÃ TỪ CHỐI KHÁNG CÁO')
                    .setDescription(`Kháng cáo của **${userTag}** đã bị từ chối.`)
                    .addFields(
                        { name: '👤 User', value: `${userTag} (ID: \`${userId}\`)` },
                        { name: '⚡ Hành động', value: 'Đã từ chối kháng cáo' },
                        { name: '👨‍💼 Xử lý bởi', value: interaction.user.tag },
                        { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }
                    )
                    .setTimestamp();
                
                await interaction.editReply({ 
                    content: '❌ Đã từ chối kháng cáo!',
                    embeds: [ownerEmbed]
                });
                
                // Disable buttons
                await interaction.message.edit({ components: [] });
                
                Logger.info(`APPEAL DENIED: ${userTag} (${userId}) bị từ chối bởi ${interaction.user.tag}`);
                
            } else if (customId.startsWith('ignore_appeal_')) {
                // XEM SAU
                
                const ownerEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⏰ ĐÃ ĐÁNH DẤU XEM SAU')
                    .setDescription(`Kháng cáo của **${userTag}** sẽ được xem xét sau.`)
                    .addFields(
                        { name: '👤 User', value: `${userTag} (ID: \`${userId}\`)` },
                        { name: '⚡ Hành động', value: 'Đánh dấu xem sau' },
                        { name: '👨‍💼 Xử lý bởi', value: interaction.user.tag },
                        { name: '📝 Ghi chú', value: 'Bạn có thể xử lý kháng cáo này sau bằng các nút bên dưới.' }
                    )
                    .setTimestamp();
                
                await interaction.editReply({ 
                    content: '⏰ Đã đánh dấu xem sau!',
                    embeds: [ownerEmbed]
                });
                
                Logger.info(`APPEAL POSTPONED: ${userTag} (${userId}) được đánh dấu xem sau bởi ${interaction.user.tag}`);
            }
            
        } catch (error) {
            Logger.error('Lỗi khi xử lý appeal button:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi xử lý')
                .setDescription('Đã có lỗi xảy ra khi xử lý kháng cáo!')
                .addFields(
                    { name: '⚠️ Chi tiết', value: error.message || 'Lỗi không xác định' }
                )
                .setTimestamp();
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
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
