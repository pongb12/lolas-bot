const Logger = require('../utils/logger');
const Config = require('../utils/config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'endprvchat',
    description: '🚫 Kết thúc và xóa private chat',
    usage: '.endprvchat',
    cooldown: 60, // 1 phút cooldown
    
    async execute(message, args, context = {}) {
        const { privateManager, bot } = context;
        const userId = message.author.id;
        
        // Kiểm tra xem có private channel không
        const channelData = privateManager.getPrivateChannel(userId);
        if (!channelData) {
            return message.reply({
                content: '❌ Bạn không có private chat nào đang hoạt động!',
                ephemeral: true
            });
        }
        
        // Tạo embed xác nhận
        const confirmEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Xác Nhận Kết Thúc Private Chat')
            .setDescription('Bạn có chắc muốn **xóa vĩnh viễn** private chat của mình?')
            .addFields(
                { name: '👤 User', value: message.author.tag, inline: true },
                { name: '📅 Tạo lúc', value: `<t:${Math.floor(channelData.createdAt / 1000)}:R>`, inline: true },
                { name: '💬 Tin nhắn', value: 'Tất cả sẽ bị xóa', inline: true },
                { name: '🚫 Hậu quả', value: '• Channel sẽ bị xóa\n• Lịch sử chat bị xóa\n• Không thể khôi phục', inline: false }
            )
            .setFooter({ text: 'Hành động này không thể hoàn tác!' })
            .setTimestamp();
        
        // Tạo buttons xác nhận
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('endprvchat_confirm')
                    .setLabel('✅ Xác nhận xóa')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('endprvchat_cancel')
                    .setLabel('❌ Hủy bỏ')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        const confirmMessage = await message.reply({
            embeds: [confirmEmbed],
            components: [confirmRow]
        });
        
        // Collector cho buttons
        const filter = (interaction) => interaction.user.id === userId;
        const collector = confirmMessage.createMessageComponentCollector({ 
            filter, 
            time: 30000,
            max: 1
        });
        
        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'endprvchat_confirm') {
                try {
                    // Xóa private channel
                    const deleted = await privateManager.deletePrivateChannel(bot.client, userId);
                    
                    if (deleted) {
                        const successEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('✅ Đã Xóa Private Chat')
                            .setDescription('Private chat của bạn đã được xóa thành công!')
                            .addFields(
                                { name: '👤 User', value: message.author.tag, inline: true },
                                { name: '⏰ Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                                { name: '🔄 Tạo mới', value: `Dùng \`${Config.PREFIX}privatechat\``, inline: true }
                            )
                            .setFooter({ text: 'Cảm ơn bạn đã sử dụng Lol.AI Private Chat!' })
                            .setTimestamp();
                        
                        await interaction.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        Logger.info(`User ${message.author.tag} đã xóa private channel`);
                    } else {
                        throw new Error('Không thể xóa channel');
                    }
                    
                } catch (error) {
                    Logger.error('Lỗi xóa private chat:', error);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Lỗi Xóa Private Chat')
                        .setDescription('Đã xảy ra lỗi khi xóa private chat.')
                        .setFooter({ text: 'Vui lòng thử lại hoặc liên hệ admin' });
                    
                    await interaction.update({
                        embeds: [errorEmbed],
                        components: []
                    });
                }
                
            } else if (interaction.customId === 'endprvchat_cancel') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('❌ Đã Hủy')
                    .setDescription('Private chat của bạn vẫn được giữ nguyên.')
                    .setFooter({ text: 'Private chat vẫn hoạt động bình thường' });
                
                await interaction.update({
                    embeds: [cancelEmbed],
                    components: []
                });
                
                Logger.info(`User ${message.author.tag} đã hủy xóa private channel`);
            }
        });
        
        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⏰ Hết thời gian xác nhận')
                    .setDescription('Private chat không bị xóa do không có phản hồi.')
                    .setTimestamp();
                
                confirmMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => {});
            }
        });
    }
};
