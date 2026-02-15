const Logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'endprvchat',
    description: '🚫 Kết thúc và xóa private chat',
    usage: '.endprvchat',
    cooldown: 10,
    
    async execute(message, args, context = {}) {
        const { privateManager, bot } = context; // context được truyền từ bot.js
        const userId = message.author.id;
        
        // 1. Kiểm tra xem có đang ở trong private chat của chính mình không
        const channelData = privateManager.getPrivateChannel(userId);
        
        if (!channelData) {
            return message.reply({ content: '❌ Bạn không có Private Chat nào!', ephemeral: true });
        }

        if (message.channel.id !== channelData.channelId) {
             return message.reply({ 
                 content: `❌ Lệnh này chỉ dùng được trong kênh Private Chat của bạn: <#${channelData.channelId}>`, 
                 ephemeral: true 
             });
        }
        
        // 2. Tạo Embed xác nhận
        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ Cảnh Báo Xóa Kênh')
            .setDescription('Bạn có chắc chắn muốn xóa kênh này?\n**Tất cả tin nhắn sẽ bị mất vĩnh viễn.**')
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('endprv_confirm')
                .setLabel('Xóa Ngay')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('endprv_cancel')
                .setLabel('Hủy Bỏ')
                .setStyle(ButtonStyle.Secondary)
        );
        
        const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });
        
        // 3. Collector xử lý button
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000,
            max: 1
        });
        
        collector.on('collect', async (i) => {
            if (i.customId === 'endprv_confirm') {
                try {
                    // [FIX QUAN TRỌNG] Update UI trước -> Đợi -> Xóa
                    // Nếu xóa ngay lập tức, bot sẽ bị lỗi vì không tìm thấy interaction để update
                    await i.update({
                        content: '✅ **Đã xác nhận!** Kênh sẽ bị xóa trong 3 giây...',
                        embeds: [],
                        components: []
                    });

                    // Đợi 3 giây
                    setTimeout(async () => {
                        await privateManager.deletePrivateChannel(bot.client, userId, 'User chủ động xóa');
                    }, 3000);

                } catch (err) {
                    Logger.error('Lỗi trong nút xác nhận xóa:', err);
                }
            } else {
                await i.update({
                    content: '❌ **Đã hủy thao tác xóa.**',
                    embeds: [],
                    components: []
                });
            }
        });
        
        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                msg.edit({ content: '⏰ Đã hết thời gian xác nhận.', components: [] }).catch(() => {});
            }
        });
    }
};
