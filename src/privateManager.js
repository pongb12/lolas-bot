const { ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

class PrivateChatManager {
    constructor() {
        this.config = Config;
        this.privateChannels = new Map(); // userId -> channelData
        this.cleanupInterval = null;
        this.startCleanup();
    }
    
    // Tạo private channel
    async createPrivateChannel(guild, user) {
        try {
            // Kiểm tra số lượng channel tối đa
            if (this.privateChannels.size >= this.config.MAX_PRIVATE_CHANNELS) {
                throw new Error('Đã đạt giới hạn private channels. Vui lòng chờ!');
            }
            
            // Kiểm tra xem user đã có channel chưa
            if (this.privateChannels.has(user.id)) {
                const existing = this.privateChannels.get(user.id);
                if (existing.channel) {
                    return existing.channel;
                }
            }
            
            // Tìm hoặc tạo category
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
                
                Logger.success(`Đã tạo category: ${category.name}`);
            }
            
            // Tạo private channel
            const channelName = `private-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: `Private chat với ${user.tag} | Tự động xóa sau 1 giờ không hoạt động`,
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
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.ManageChannels
                        ]
                    }
                ]
            });
            
            // Lưu thông tin channel
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
            
            Logger.success(`Đã tạo private channel cho ${user.tag} (${channel.id})`);
            
            // Gửi welcome message
            await channel.send({
                content: `👋 **Chào mừng đến Private Chat, ${user}!**\n\n` +
                        `Đây là kênh chat riêng giữa bạn và Lol.AI.\n` +
                        `📌 **Lưu ý:**\n` +
                        `• Kênh sẽ tự động xóa sau 1 giờ không hoạt động\n` +
                        `• Dùng \`${this.config.PREFIX}endprvchat\` để kết thúc sớm\n` +
                        `• Mọi tin nhắn ở đây đều riêng tư\n\n` +
                        `Hãy bắt đầu trò chuyện nào! 🎮`
            });
            
            return channel;
            
        } catch (error) {
            Logger.error('Lỗi tạo private channel:', error);
            throw error;
        }
    }
    
    // Lấy private channel của user
    getPrivateChannel(userId) {
        const data = this.privateChannels.get(userId);
        return data ? data : null;
    }
    
    // Cập nhật thời gian hoạt động
    updateActivity(userId) {
        const data = this.privateChannels.get(userId);
        if (data) {
            data.lastActivity = Date.now();
            return true;
        }
        return false;
    }
    
    // Xóa private channel
    async deletePrivateChannel(client, userId) {
        try {
            const data = this.privateChannels.get(userId);
            if (!data) return false;
            
            const guild = client.guilds.cache.get(data.guildId);
            if (!guild) {
                this.privateChannels.delete(userId);
                return false;
            }
            
            const channel = guild.channels.cache.get(data.channelId);
            if (channel) {
                await channel.delete('Private chat ended');
                Logger.info(`Đã xóa private channel của ${data.userName}`);
            }
            
            // Kiểm tra và xóa category nếu rỗng
            await this.cleanupEmptyCategory(guild, data.categoryId);
            
            this.privateChannels.delete(userId);
            return true;
            
        } catch (error) {
            Logger.error('Lỗi xóa private channel:', error);
            return false;
        }
    }
    
    // Dọn dẹp category rỗng
    async cleanupEmptyCategory(guild, categoryId) {
        try {
            const category = guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) return;
            
            const children = guild.channels.cache.filter(c => c.parentId === categoryId);
            
            if (children.size === 0) {
                await category.delete('Category is empty');
                Logger.info(`Đã xóa category rỗng: ${category.name}`);
            }
        } catch (error) {
            Logger.error('Lỗi cleanup category:', error);
        }
    }
    
    // Tự động dọn dẹp channels không hoạt động
    startCleanup() {
        this.cleanupInterval = setInterval(async () => {
            const now = Date.now();
            const inactiveUsers = [];
            
            for (const [userId, data] of this.privateChannels.entries()) {
                if (now - data.lastActivity > this.config.PRIVATE_CHANNEL_TIMEOUT) {
                    inactiveUsers.push({ userId, data });
                }
            }
            
            if (inactiveUsers.length > 0) {
                Logger.info(`Tự động dọn dẹp ${inactiveUsers.length} private channels không hoạt động`);
            }
            
        }, 300000); // Kiểm tra mỗi 5 phút
    }
    
    // Dừng cleanup
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    // Lấy thông tin thống kê
    getStats() {
        return {
            totalChannels: this.privateChannels.size,
            activeChannels: Array.from(this.privateChannels.values()).filter(
                data => Date.now() - data.lastActivity < 300000 // 5 phút
            ).length,
            userList: Array.from(this.privateChannels.values()).map(data => ({
                userId: data.userId,
                userName: data.userName,
                channelId: data.channelId,
                lastActivity: new Date(data.lastActivity).toLocaleTimeString('vi-VN'),
                activeMinutes: Math.floor((Date.now() - data.lastActivity) / 60000)
            }))
        };
    }
}

module.exports = PrivateChatManager;
