const { ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./config');
const Logger = require('./logger');

class PrivateChatManager {
    constructor() {
        this.config = Config;
        this.privateChannels = new Map(); // userId -> channelData
        this.cleanupInterval = null;
    }
    
    // Khởi động cleanup service (GỌI HÀM NÀY KHI BOT READY)
    startCleanup(client) {
        if (this.cleanupInterval) return;

        Logger.info('🔄 Đã khởi động dịch vụ dọn dẹp Private Chat');
        
        this.cleanupInterval = setInterval(async () => {
            const now = Date.now();
            const timeout = this.config.PRIVATE_CHANNEL_TIMEOUT || 3600000; // 1 giờ mặc định
            
            for (const [userId, data] of this.privateChannels.entries()) {
                if (now - data.lastActivity > timeout) {
                    Logger.info(`⏳ Channel của ${data.userName} đã hết hạn. Đang xóa...`);
                    // Truyền client vào để thực hiện xóa
                    await this.deletePrivateChannel(client, userId, 'Hết thời gian hoạt động');
                }
            }
        }, this.config.AUTO_CLEANUP_INTERVAL || 600000); // 10 phút check 1 lần
    }

    // Dừng cleanup
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    // Tạo private channel
    async createPrivateChannel(guild, user) {
        try {
            // 1. Kiểm tra giới hạn tổng
            if (this.privateChannels.size >= this.config.MAX_PRIVATE_CHANNELS) {
                throw new Error('Server đã đạt giới hạn số lượng Private Channel!');
            }
            
            // 2. Kiểm tra xem user đã có channel chưa (FIX BUG: check ID trong cache)
            if (this.privateChannels.has(user.id)) {
                const existing = this.privateChannels.get(user.id);
                const existingChannel = guild.channels.cache.get(existing.channelId);
                if (existingChannel) {
                    return existingChannel;
                } else {
                    // Nếu trong data có nhưng thực tế channel đã mất -> Xóa data cũ
                    this.privateChannels.delete(user.id);
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
            
            // 4. Tạo channel mới
            const channelName = `🔒-private-${user.username.slice(0, 10)}`; // Rút ngắn tên để tránh lỗi
            
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
                content: `👋 Chào ${user}, đây là không gian riêng tư của bạn.\n⚠️ Channel sẽ tự xóa sau **1 giờ** không hoạt động.`
            });
            
            return channel;
            
        } catch (error) {
            Logger.error('Lỗi tạo private channel:', error);
            throw error;
        }
    }
    
    // Lấy thông tin channel
    getPrivateChannel(userId) {
        return this.privateChannels.get(userId) || null;
    }
    
    // Cập nhật hoạt động (Quan trọng để không bị xóa oan)
    updateActivity(userId) {
        const data = this.privateChannels.get(userId);
        if (data) {
            data.lastActivity = Date.now();
            return true;
        }
        return false;
    }
    
    // Xóa private channel
    async deletePrivateChannel(client, userId, reason = 'User requested') {
        try {
            const data = this.privateChannels.get(userId);
            if (!data) return false;
            
            // Xóa khỏi map trước để tránh loop
            this.privateChannels.delete(userId);

            const guild = client.guilds.cache.get(data.guildId);
            if (!guild) return false;
            
            const channel = guild.channels.cache.get(data.channelId);
            if (channel) {
                await channel.delete(reason);
                Logger.info(`🗑️ Đã xóa channel của ${data.userName} (${reason})`);
            }
            
            // Check cleanup category
            this.cleanupEmptyCategory(guild, data.categoryId);
            return true;
            
        } catch (error) {
            Logger.error('Lỗi xóa private channel:', error);
            return false;
        }
    }
    
    async cleanupEmptyCategory(guild, categoryId) {
        try {
            const category = guild.channels.cache.get(categoryId);
            if (!category) return;
            
            // Kiểm tra xem category còn con không (cần fetch để chính xác)
            const channels = guild.channels.cache.filter(c => c.parentId === categoryId);
            if (channels.size === 0) {
                await category.delete('Dọn dẹp category rỗng');
            }
        } catch (e) {
            // Bỏ qua lỗi xóa category
        }
    }

    getStats() {
        return {
            totalChannels: this.privateChannels.size,
            activeChannels: Array.from(this.privateChannels.values()).length, // Tạm tính bằng total
            users: Array.from(this.privateChannels.values()).map(d => d.userName)
        };
    }
}

module.exports = PrivateChatManager;
