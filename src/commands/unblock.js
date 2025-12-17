const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'unblock',
    description: '🔓 Gỡ chặn user (owner only)',
    usage: '.unblock <userId>',
    
    async execute(message, args) {
        // Chỉ owner mới được sử dụng
        if (message.author.id !== Config.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Truy cập bị từ chối')
                .setDescription('Chỉ Admin mới có quyền sử dụng lệnh này!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Kiểm tra argument
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Thiếu thông tin')
                .setDescription('Vui lòng cung cấp User ID cần gỡ chặn!')
                .addFields(
                    { name: 'Cách dùng', value: '`.unblock <userId>`' },
                    { name: 'Ví dụ', value: '`.unblock 123456789012345678`' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const userId = args[0];
        
        // Kiểm tra định dạng User ID
        if (!/^\d{17,20}$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ User ID không hợp lệ')
                .setDescription('User ID phải là số từ 17-20 chữ số!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        try {
            // Gọi hàm unblock từ AIHandler
            const result = ai.unblockUser(userId);
            
            if (result) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Đã gỡ chặn thành công')
                    .addFields(
                        { name: '👤 User ID', value: userId },
                        { name: '👑 Thực hiện bởi', value: 'Admin' }
                    )
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                
                // Log hành động
                Logger.warn(`OWNER: ${message.author.tag} đã gỡ chặn user ${userId}`);
                
                // Gửi thông báo cho user nếu có thể
                try {
                    const user = await message.client.users.fetch(userId);
                    if (user) {
                        const dmEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🔓 Tài khoản của bạn đã được gỡ chặn')
                            .setDescription('Bạn có thể sử dụng bot bình thường trở lại.')
                            .addFields(
                                { name: '👑 Bởi', value: 'Chủ sở hữu bot' },
                                { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
                                { name: '💡 Lưu ý', value: 'Vui lòng tuân thủ quy tắc sử dụng để tránh bị chặn lại.' }
                            )
                            .setFooter({ text: 'Lol.AI Security System' })
                            .setTimestamp();
                        
                        await user.send({ embeds: [dmEmbed] });
                    }
                } catch (dmError) {
                    // Không thể gửi DM, bỏ qua
                }
            } else {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ User không bị chặn')
                    .setDescription(`User ${userId} không có trong danh sách bị chặn.`)
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
            }
            
        } catch (error) {
            Logger.error('Lỗi khi gỡ chặn user:', error);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi hệ thống')
                .setDescription('Không thể gỡ chặn user lúc này. Vui lòng thử lại sau!')
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
