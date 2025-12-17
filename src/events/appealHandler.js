const { EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');
const ai = require('../ai');
const Config = require('../utils/config');

module.exports = {
    name: 'interactionCreate',
    
    async execute(interaction) {
        // Chỉ xử lý button interactions
        if (!interaction.isButton()) return;
        
        const customId = interaction.customId;
        
        // Kiểm tra xem có phải button appeal không
        if (!customId.startsWith('approve_appeal_') && 
            !customId.startsWith('deny_appeal_') && 
            !customId.startsWith('ignore_appeal_')) {
            return;
        }
        
        // Chỉ owner mới được xử lý
        if (interaction.user.id !== Config.OWNER_ID) {
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
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            const userTag = user ? user.tag : `Unknown User (${userId})`;
            
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
                            { name: '📞 Hỗ trợ', value: `Nếu bạn có thắc mắc, vui lòng liên hệ: <@${Config.OWNER_ID}>` },
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
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
