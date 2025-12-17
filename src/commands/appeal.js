const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'appeal',
    description: '📝 Gửi kháng cáo khi bị chặn',
    usage: '.appeal <lý do>',
    
    async execute(message, args) {
        const userId = message.author.id;
        const userTag = message.author.tag;
        
        // Kiểm tra xem user có bị chặn không
        const isBlocked = ai.isUserBlocked(userId);
        
        if (!isBlocked) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('ℹ️ Thông tin')
                .setDescription('Tài khoản của bạn **KHÔNG** bị chặn.')
                .addFields(
                    { name: 'Tình trạng', value: '✅ Hoạt động bình thường' },
                    { name: 'Ghi chú', value: 'Chỉ sử dụng lệnh này nếu bạn bị chặn và muốn kháng cáo.' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Kiểm tra lý do
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📝 Gửi kháng cáo')
                .setDescription('Vui lòng cung cấp lý do kháng cáo của bạn!')
                .addFields(
                    { name: 'Cách dùng', value: '`.appeal <lý do>`' },
                    { name: 'Ví dụ', value: '`.appeal < nội dung kháng cáo >`' },
                    { name: '⚠️ Lưu ý', value: 'Kháng cáo sẽ được gửi trực tiếp cho Admin. Vui lòng cung cấp lý do chân thành.' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const reason = args.join(' ');
        
        // Giới hạn độ dài lý do
        if (reason.length > 500) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lý do quá dài')
                .setDescription('Lý do kháng cáo không được vượt quá 500 ký tự!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        try {
            // Lấy thông tin owner từ config
            const ownerId = Config.OWNER_ID;
            const owner = await message.client.users.fetch(ownerId);
            
            if (!owner) {
                throw new Error('Không tìm thấy chủ bot');
            }
            
            // Tạo embed kháng cáo
            const appealEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📢 KHÁNG CÁO MỚI')
                .setDescription('Có user gửi kháng cáo yêu cầu gỡ chặn!')
                .addFields(
                    { name: '👤 User', value: `${userTag} (ID: ${userId})` },
                    { name: '📝 Lý do kháng cáo', value: reason },
                    { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
                    { name: '🔗 Liên kết', value: `[Nhắn tin cho user](https://discord.com/users/${userId})` }
                )
                .setFooter({ text: 'Lol.AI Appeal System' })
                .setTimestamp();
            
            // Tạo buttons cho owner
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_appeal_${userId}`)
                        .setLabel('✅ Chấp nhận')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('👍'),
                    new ButtonBuilder()
                        .setCustomId(`deny_appeal_${userId}`)
                        .setLabel('❌ Từ chối')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('👎'),
                    new ButtonBuilder()
                        .setCustomId(`ignore_appeal_${userId}`)
                        .setLabel('⏰ Xem sau')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏳')
                );
            
            // Gửi cho owner
            await owner.send({
                content: `📢 **KHÁNG CÁO MỚI** từ ${userTag}`,
                embeds: [appealEmbed],
                components: [actionRow]
            });
            
            // Thông báo cho user
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Đã gửi kháng cáo thành công')
                .setDescription('Kháng cáo của bạn đã được gửi đến Admin!')
                .addFields(
                    { name: '📝 Lý do đã gửi', value: reason.substring(0, 200) + (reason.length > 200 ? '...' : '') },
                    { name: '⏳ Thời gian xử lý', value: 'Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.' },
                    { name: '📨 Thông báo', value: 'Bạn sẽ nhận được DM khi có kết quả.' }
                )
                .setTimestamp();
            
            await message.reply({ embeds: [successEmbed] });
            
            // Log kháng cáo
            Logger.warn(`APPEAL: ${userTag} (${userId}) đã gửi kháng cáo: ${reason.substring(0, 50)}...`);
            
        } catch (error) {
            Logger.error('Lỗi khi gửi kháng cáo:', error);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Không thể gửi kháng cáo')
                .setDescription('Đã có lỗi xảy ra khi gửi kháng cáo của bạn!')
                .addFields(
                    { name: '📞 Liên hệ thủ công', value: `Vui lòng liên hệ trực tiếp với Admin: <@${Config.OWNER_ID}>` },
                    { name: '📝 Ghi chú', value: 'Vui lòng cung cấp User ID của bạn khi liên hệ: `' + userId + '`' }
                )
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
