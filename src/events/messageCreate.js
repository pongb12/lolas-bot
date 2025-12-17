const { Events, EmbedBuilder } = require('discord.js');
const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');

module.exports = {
    name: Events.MessageCreate,
    
    async execute(message) {
        // Bỏ qua nếu là bot
        if (message.author.bot) return;
        
        // Xử lý lệnh thông thường (giữ nguyên code hiện có)
        // ...
    }
};

// Thêm event handler cho interactionCreate (xử lý buttons)
module.exports.interactionHandler = async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Kiểm tra xem có phải button appeal không
    if (interaction.customId.startsWith('approve_appeal_') || 
        interaction.customId.startsWith('deny_appeal_') || 
        interaction.customId.startsWith('ignore_appeal_')) {
        
        // Chỉ owner mới được xử lý
        if (interaction.user.id !== Config.OWNER_ID) {
            return interaction.reply({
                content: '❌ Chỉ Admin mới có quyền xử lý kháng cáo!',
                ephemeral: true
            });
        }
        
        const action = interaction.customId.split('_')[0]; // approve, deny, ignore
        const userId = interaction.customId.split('_')[2];
        
        try {
            // Lấy thông tin user
            const user = await interaction.client.users.fetch(userId);
            
            if (action === 'approve') {
                // Gỡ chặn user
                ai.unblockUser(userId);
                
                // Cập nhật message
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x00FF00)
                    .setTitle('✅ KHÁNG CÁO ĐƯỢC CHẤP NHẬN')
                    .addFields(
                        { name: '👑 Xử lý bởi', value: 'Chủ bot' },
                        { name: '✅ Kết quả', value: 'ĐÃ GỠ CHẶN' }
                    );
                
                await interaction.message.edit({
                    embeds: [newEmbed],
                    components: []
                });
                
                await interaction.reply({
                    content: `✅ Đã chấp nhận kháng cáo và gỡ chặn user ${user.tag}`,
                    ephemeral: true
                });
                
                // Gửi thông báo cho user
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Kháng cáo của bạn đã được chấp nhận')
                    .setDescription('Tài khoản của bạn đã được gỡ chặn!')
                    .addFields(
                        { name: '👑 Bởi', value: 'Owner' },
                        { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
                        { name: '💡 Lưu ý', value: 'Vui lòng tuân thủ quy tắc sử dụng bot để tránh bị chặn lại.' }
                    )
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
                
                Logger.warn(`APPEAL: Chủ bot đã chấp nhận kháng cáo của ${user.tag}`);
                
            } else if (action === 'deny') {
                // Từ chối kháng cáo
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0xFF0000)
                    .setTitle('❌ KHÁNG CÁO BỊ TỪ CHỐI')
                    .addFields(
                        { name: '👑 Xử lý bởi', value: 'Owner' },
                        { name: '❌ Kết quả', value: 'KHÔNG GỠ CHẶN' }
                    );
                
                await interaction.message.edit({
                    embeds: [newEmbed],
                    components: []
                });
                
                await interaction.reply({
                    content: `❌ Đã từ chối kháng cáo của user ${user.tag}`,
                    ephemeral: true
                });
                
                // Gửi thông báo cho user
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Kháng cáo của bạn đã bị từ chối')
                    .setDescription('Tài khoản của bạn vẫn bị chặn.')
                    .addFields(
                        { name: '👑 Bởi', value: ' Owner ' },
                        { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
                        { name: '⏳ Thời hạn chặn', value: 'Bạn có thể thử lại sau 1 giờ.' },
                        { name: '📞 Liên hệ', value: `Nếu cần giải thích, liên hệ: <@${Config.OWNER_ID}>` }
                    )
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
                
                Logger.warn(`APPEAL: Admin đã từ chối kháng cáo của ${user.tag}`);
                
            } else if (action === 'ignore') {
                // Bỏ qua (xem sau)
                const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0xFFA500)
                    .setTitle('⏳ KHÁNG CÁO ĐỢI XỬ LÝ')
                    .addFields(
                        { name: '👑 Đánh dấu bởi', value: 'Owner' },
                        { name: '⏳ Trạng thái', value: 'ĐỢI XEM SAU' }
                    );
                
                await interaction.message.edit({
                    embeds: [newEmbed],
                    components: []
                });
                
                await interaction.reply({
                    content: `⏳ Đã đánh dấu kháng cáo của ${user.tag} là "xem sau"`,
                    ephemeral: true
                });
                
                Logger.warn(`APPEAL: Chủ bot đã đánh dấu kháng cáo của ${user.tag} là "xem sau"`);
            }
            
        } catch (error) {
            Logger.error('Lỗi khi xử lý button appeal:', error);
            await interaction.reply({
                content: '❌ Đã có lỗi xảy ra khi xử lý kháng cáo!',
                ephemeral: true
            });
        }
    }
};
