const Logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'endprvchat',
    description: '🚫 Kết thúc và xóa private chat',
    usage: '.endprvchat',
    cooldown: 10,
    
    async execute(message, args, context = {}) {
        const { privateManager, bot } = context;
        const userId = message.author.id;
        
        // 1. Kiểm tra tồn tại
        const channelData = privateManager.getPrivateChannel(userId);
        
        // Chỉ cho phép dùng lệnh này TRONG private channel đó
        if (!channelData || message.channel.id !== channelData.channelId) {
            return message.reply({
                content: '❌ Lệnh này chỉ dùng được trong Private Chat của bạn!',
                ephemeral: true
            });
        }
        
        // 2. Tạo giao diện xác nhận
        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Cảnh Báo Xóa Chat')
            .setDescription('Bạn có chắc chắn muốn xóa kênh này không?\n**Hành động này không thể hoàn tác.**')
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('endprv_confirm')
                .setLabel('Xóa ngay')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('endprv_cancel')
                .setLabel('Hủy')
                .setStyle(ButtonStyle.Secondary)
        );
        
        const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });
        
        // 3. Xử lý button
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000,
            max: 1
        });
        
        collector.on('collect', async (i) => {
            if (i.customId === 'endprv_confirm') {
                // UPDATE GIAO DIỆN TRƯỚC KHI XÓA (FIX BUG UNKNOWN INTERACTION)
                await i.update({
                    content: '✅ **Đã xác nhận!** Kênh sẽ bị xóa trong 3 giây...',
                    embeds: [],
                    components: []
                });

                // Đợi 3s rồi xóa
                setTimeout(async () => {
                    await privateManager.deletePrivateChannel(bot.client, userId, 'User chủ động xóa');
                }, 3000);

            } else {
                await i.update({
                    content: '❌ **Đã hủy thao tác xóa.**',
                    embeds: [],
                    components: []
                });
            }
        });
    }
};
