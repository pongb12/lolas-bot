const Logger = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'feedbacks',
    description: '📢 Gửi phản hồi cho tác giả',
    usage: '.feedbacks <nội dung>',

    async execute(message, args) {
        // Kiểm tra xem có nội dung không
        if (args.length === 0) {
            return message.reply('❌ Vui lòng nhập nội dung phản hồi!\nVí dụ: `.feedbacks Bot rất hữu ích, nhưng cần thêm tính năng X`');
        }

        const feedbackContent = args.join(' ');
        const userId = message.author.id;
        const userTag = message.author.tag;
        const channelName = message.channel.name || 'Direct Message';
        const guildName = message.guild ? message.guild.name : 'Direct Message';

        // ID của bạn (thay đổi nếu cần)
        const ownerId = '1003323955693764748';

        try {
            // Tìm user tác giả bằng ID
            const owner = await message.client.users.fetch(ownerId);

            if (!owner) {
                Logger.error(`Không tìm thấy user với ID: ${ownerId}`);
                return message.reply('❌ Không thể gửi phản hồi lúc này. Vui lòng thử lại sau!');
            }

            // Tạo embed phản hồi
            const feedbackEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📢 Phản hồi mới từ người dùng')
                .addFields(
                    { name: '👤 Người gửi', value: `${userTag} (ID: ${userId})` },
                    { name: '🏠 Server', value: guildName },
                    { name: '📁 Kênh', value: channelName },
                    { name: '📝 Nội dung', value: feedbackContent }
                )
                .setTimestamp()
                .setFooter({ text: 'Lol.AI Feedback System' });

            // Gửi DM cho tác giả
            await owner.send({ embeds: [feedbackEmbed] });

            // Thông báo thành công cho người dùng
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Đã gửi phản hồi thành công!')
                .setDescription('Cảm ơn bạn đã gửi phản hồi! Tác giả sẽ xem xét và cải thiện bot.')
                .addFields(
                    { name: '📝 Nội dung đã gửi', value: feedbackContent.substring(0, 500) + (feedbackContent.length > 500 ? '...' : '') }
                )
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });

            Logger.info(`📢 Feedback từ ${userTag}: ${feedbackContent.substring(0, 50)}...`);

        } catch (error) {
            Logger.error('Lỗi khi gửi feedback:', error);

            // Fallback: Gửi vào kênh log nếu có
            const logChannel = message.client.channels.cache.find(ch => ch.name === 'bot-logs' || ch.name === 'log');
            if (logChannel) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('📢 Feedback (Gửi thất bại)')
                    .addFields(
                        { name: '👤 Người gửi', value: userTag },
                        { name: '📝 Nội dung', value: feedbackContent },
                        { name: '⚠️ Lỗi', value: error.message }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [errorEmbed] });
            }

            // Thông báo lỗi cho người dùng
            const errorMessage = await message.reply('❌ Không thể gửi phản hồi trực tiếp. Đã lưu lại phản hồi của bạn!');
            
            // Tự động xóa sau 5 giây
            setTimeout(() => {
                errorMessage.delete().catch(() => {});
            }, 5000);
        }
    }
};
