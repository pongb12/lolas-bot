const { ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class PrivateChatManager {
    constructor() {
        this.config = Config;
        this.privateChannels = new Map(); // Map<userId, channelData>
        this.cleanupInterval = null;
    }
    
    // [FIX] Hàm khởi động dọn dẹp tự động (gọi khi Bot Ready)
    startCleanup(client) {
        if (this.cleanupInterval) return;

        Logger.info('🔄 Đã khởi động dịch vụ dọn dẹp Private Chat');
        
        this.cleanupInterval = setInterval(async () => {
            const now = Date.now();
            // Lấy timeout từ config hoặc mặc định 1 giờ
            const timeout = this.config.PRIVATE_CHANNEL_TIMEOUT || 3600000; 
            
            for (const [userId, data] of this.privateChannels.entries()) {
                // Kiểm tra thời gian không hoạt động
                if (now - data.lastActivity > timeout) {
                    Logger.info(`⏳ Channel của ${data.userName} đã hết hạn hoạt động.`);
                    // [FIX] Truyền client vào để thực hiện xóa thật
                    await this.deletePrivateChannel(client, userId, 'Hết thời gian hoạt động');
                }
            }
        }, this.config.AUTO_CLEANUP_INTERVAL || 600000); // Check mỗi 10 phút
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    async createPrivateChannel(guild, user) {
        try {
            // 1. Kiểm tra giới hạn
            if (this.privateChannels.size >= this.config.MAX_PRIVATE_CHANNELS) {
                throw new Error('Server đã đạt giới hạn số lượng Private Channel!');
            }
            
            // 2. [FIX] Kiểm tra user đã có channel chưa (Check kỹ trong Cache)
            if (this.privateChannels.has(user.id)) {
                const existing = this.privateChannels.get(user.id);
                const existingChannel = guild.channels.cache.get(existing.channelId);
                
                if (existingChannel) {
                    return existingChannel; // Trả về channel cũ nếu còn tồn tại
                } else {
                    this.privateChannels.delete(user.id); // Xóa data rác nếu channel đã mất
                }
            }
            
            // 3. Tìm hoặc tạo Category
            let category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && 
                c.name === this.config.PRIVATE_CATEGORY_NAME
            );
            
            if (!category) {
                category = await guild.channels.create({
                    name: this.config.PRIVATE_CATEGORY_NAME,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        }
                    ]
                });
            }
            
            // 4. Tạo Private Channel
            // [FIX] Rút gọn tên để tránh lỗi độ dài tên kênh
            const channelName = `🔒-private-${user.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`; 
            
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: `Chat riêng với ${user.tag} | ID: ${user.id}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: guild.client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                    }
                ]
            });
            
            // 5. Lưu data
            const channelData = {
                channelId: channel.id,
                userId: user.id,
                guildId: guild.id,
                categoryId: category.id,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                userName: user.tag
            };
            
            this.privateChannels.set(user.id, channelData);
            
            // 6. Gửi tin nhắn chào mừng
            await channel.send({
                content: `👋 **Xin chào ${user}!**\nĐây là không gian riêng tư của bạn với Bot.\n⚠️ Kênh sẽ tự động xóa sau **1 giờ** không hoạt động.\nSử dụng \`${this.config.PREFIX}endprvchat\` để xóa ngay lập tức.`
            });
            
            Logger.success(`Đã tạo Private Channel cho ${user.tag}`);
            return channel;
            
        } catch (error) {
            Logger.error('Lỗi tạo private channel:', error);
            throw error;
        }
    }
    
    getPrivateChannel(userId) {
        return this.privateChannels.get(userId) || null;
    }
    
    // [FIX] Cập nhật hoạt động để tránh bị xóa oan
    updateActivity(userId) {
        const data = this.privateChannels.get(userId);
        if (data) {
            data.lastActivity = Date.now();
            return true;
        }
        return false;
    }
    
    // [FIX] Hàm xóa channel an toàn
    async deletePrivateChannel(client, userId, reason = 'Unknown') {
        try {
            const data = this.privateChannels.get(userId);
            if (!data) return false;
            
            // Xóa khỏi Map trước để tránh loop
            this.privateChannels.delete(userId);
            
            const guild = client.guilds.cache.get(data.guildId);
            if (!guild) return false; // Bot không còn trong server
            
            const channel = guild.channels.cache.get(data.channelId);
            if (channel) {
                await channel.delete(reason);
                Logger.info(`🗑️ Đã xóa channel của ${data.userName} | Lý do: ${reason}`);
            }
            
            // Kiểm tra và xóa Category nếu rỗng
            this.cleanupEmptyCategory(guild, data.categoryId);
            return true;
            
        } catch (error) {
            Logger.error(`Lỗi xóa private channel của user ${userId}:`, error);
            return false;
        }
    }
    
    async cleanupEmptyCategory(guild, categoryId) {
        try {
            const category = guild.channels.cache.get(categoryId);
            if (!category) return;
            
            const channels = guild.channels.cache.filter(c => c.parentId === categoryId);
            if (channels.size === 0) {
                await category.delete('Dọn dẹp category rỗng');
                Logger.info('Đã xóa category rỗng');
            }
        } catch (e) {
            // Không quan trọng nếu lỗi xóa category
        }
    }

    getStats() {
        return {
            totalChannels: this.privateChannels.size,
            activeChannels: this.privateChannels.size,
            users: Array.from(this.privateChannels.values()).map(d => d.userName)
        };
    }
}

module.exports = PrivateChatManager;
