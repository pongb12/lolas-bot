const Logger = require('../utils/logger');
const Config = require('../utils/config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'privatechat',
    description: '🔒 Tạo private chat riêng với Lol.AI',
    usage: '.privatechat',
    cooldown: 300, // 5 phút cooldown
    
    async execute(message, args, context = {}) {
        const { privateManager } = context;
        
        // Kiểm tra xem đang trong server
        if (!message.guild) {
            return message.reply('❌ Lệnh này chỉ có thể dùng trong server!');
        }
        
        // Kiểm tra quyền
        if (!message.member.permissions.has('ViewChannel')) {
            return message.reply('❌ Bạn không có quyền tạo private channel!');
        }
        
        try {
            // Kiểm tra xem đã có private channel chưa
            const existingChannel = privateManager.getPrivateChannel(message.author.id);
            if (existingChannel) {
                const guild = message.guild;
                const channel = guild.channels.cache.get(existingChannel.channelId);
                
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('🔒 Bạn đã có Private Chat!')
                        .setDescription(`Bạn đã có private chat tại: ${channel}`)
                        .addFields(
                            { name: '📁 Channel', value: `${channel}`, inline: true },
                            { name: '⏰ Tạo lúc', value: `<t:${Math.floor(existingChannel.createdAt / 1000)}:R>`, inline: true },
                            { name: '🔄 Hoạt động', value: `<t:${Math.floor(existingChannel.lastActivity / 1000)}:R>`, inline: true }
                        )
                        .setFooter({ text: 'Dùng .endprvchat để kết thúc private chat' });
                    
                    return message.reply({ embeds: [embed], ephemeral: true });
                }
            }
            
            // Tạo private channel mới
            message.channel.sendTyping();
            
            const channel = await privateManager.createPrivateChannel(message.guild, message.author);
            
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Private Chat Đã Sẵn Sàng!')
                .setDescription(`Private chat của bạn đã được tạo: ${channel}`)
                .addFields(
                    { name: '🔗 Truy cập', value: `Click vào: ${channel}`, inline: false },
                    { name: '⏰ Tự động xóa', value: 'Sau 1 giờ không hoạt động', inline: true },
                    { name: '🔒 Riêng tư', value: 'Chỉ bạn và bot có thể xem', inline: true },
                    { name: '❌ Kết thúc', value: `Dùng \`${Config.PREFIX}endprvchat\``, inline: true }
                )
                .setFooter({ text: 'Hãy vào channel để bắt đầu chat riêng!' });
            
            await message.reply({ 
                content: `${message.author}`, 
                embeds: [successEmbed] 
            });
            
            Logger.info(`User ${message.author.tag} đã tạo private channel: ${channel.id}`);
            
        } catch (error) {
            Logger.error('Lỗi tạo private chat:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi Tạo Private Chat')
                .setDescription(error.message)
                .addFields(
                    { name: '📝 Nguyên nhân có thể', value: '• Mẹo Mày Bé\n• Đã đạt giới hạn channels\n• Lỗi server', inline: false },
                    { name: '🔄 Thử lại', value: 'Chờ 5 phút rồi thử lại', inline: true }
                );
            
            await message.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};
