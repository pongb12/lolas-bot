const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'unban',
    description: '👑 Gỡ ban user (owner only)',
    usage: '.unban <userId>',
    
    async execute(message, args) {
        // Chỉ owner mới được sử dụng
        if (message.author.id !== Config.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Truy cập bị từ chối')
                .setDescription('Chỉ chủ sở hữu bot mới có quyền gỡ ban user!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Thiếu thông tin')
                .setDescription('Vui lòng cung cấp User ID cần gỡ ban!')
                .addFields(
                    { name: 'Cách dùng', value: '`.unban <userId>`' },
                    { name: 'Ví dụ', value: '`.unban 123456789012345678`' },
                    { name: 'Lấy User ID', value: 'Bật Developer Mode Discord → Right click user → Copy ID' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const targetUserId = args[0];
        
        // Kiểm tra User ID hợp lệ
        if (!/^\d{17,20}$/.test(targetUserId)) {
            return message.reply('❌ User ID không hợp lệ! User ID phải có 17-20 chữ số.');
        }
        
        try {
            // Gỡ ban user
            const result = ai.unblockUser(targetUserId);
            
            if (result) {
                // Lấy thông tin user
                const targetUser = await message.client.users.fetch(targetUserId).catch(() => null);
                const username = targetUser ? targetUser.tag : `Unknown (ID: ${targetUserId})`;
                
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ ĐÃ GỠ BAN USER')
                    .addFields(
                        { name: '👤 User', value: username },
                        { name: '🆔 User ID', value: targetUserId },
                        { name: '👮 Gỡ ban bởi', value: message.author.tag },
                        { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') }
                    )
                    .setFooter({ text: 'Lol.AI Security System' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                
                Logger.warn(`👑 Owner ${message.author.tag} unbanned ${username} (${targetUserId})`);
                
                // Gửi DM thông báo cho user (nếu có thể)
                if (targetUser) {
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('✅ BẠN ĐÃ ĐƯỢC GỠ BAN')
                            .setDescription('Tài khoản của bạn đã được gỡ chặn trên bot Lol.AI')
                            .addFields(
                                { name: '👮 Bởi', value: message.author.tag },
                                { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
                                { name: '💡 Lưu ý', value: 'Vui lòng tuân thủ quy tắc sử dụng để tránh bị chặn lại.' }
                            )
                            .setFooter({ text: 'Lol.AI Security System' })
                            .setTimestamp();
                        
                        await targetUser.send({ embeds: [dmEmbed] });
                    } catch (dmError) {
                        Logger.warn(`Cannot send DM to unbanned user ${targetUserId}`);
                    }
                }
            } else {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ User không bị chặn')
                    .setDescription(`User ${targetUserId} không có trong danh sách bị chặn.`)
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
            }
            
        } catch (error) {
            Logger.error('Error in unban command:', error);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi hệ thống')
                .setDescription('Không thể gỡ ban user lúc này. Vui lòng thử lại sau!')
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
