const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setban',
    description: '👑 Ban user theo thời gian tùy chỉnh (owner only)',
    usage: '.setban <userId> <số> <đơn vị (s/m/h/d)>',
    
    async execute(message, args) {
        // Chỉ owner mới được sử dụng
        if (message.author.id !== Config.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Truy cập bị từ chối')
                .setDescription('Chỉ chủ sở hữu bot mới có quyền ban user!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Thiếu thông tin')
                .setDescription('Vui lòng cung cấp đủ thông tin!')
                .addFields(
                    { name: 'Cách dùng', value: '`.setban <userId> <số> <đơn vị>`' },
                    { name: 'Ví dụ', value: 
                        '`.setban 123456789012345678 30 m` - Ban 30 phút\n' +
                        '`.setban 123456789012345678 2 h` - Ban 2 giờ\n' +
                        '`.setban 123456789012345678 1 d` - Ban 1 ngày\n' +
                        '`.setban 123456789012345678 300 s` - Ban 300 giây'
                    },
                    { name: 'Đơn vị hỗ trợ', value: 's = giây, m = phút, h = giờ, d = ngày' },
                    { name: 'Lấy User ID', value: 'Bật Developer Mode Discord → Right click user → Copy ID' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const targetUserId = args[0];
        const timeValue = parseInt(args[1]);
        const unit = args[2].toLowerCase();
        
        // Kiểm tra User ID hợp lệ
        if (!/^\d{17,20}$/.test(targetUserId)) {
            return message.reply('❌ User ID không hợp lệ! User ID phải có 17-20 chữ số.');
        }
        
        // Kiểm tra không tự ban chính mình
        if (targetUserId === Config.OWNER_ID) {
            return message.reply('❌ Bạn không thể ban chính mình!');
        }
        
        // Kiểm tra không ban bot
        try {
            const user = await message.client.users.fetch(targetUserId);
            if (user.bot) {
                return message.reply('❌ Không thể ban bot!');
            }
        } catch (error) {
            // Nếu không fetch được user, vẫn tiếp tục nhưng cảnh báo
            Logger.warn(`Cannot fetch user ${targetUserId}, but will continue with ban`);
        }
        
        if (isNaN(timeValue) || timeValue <= 0) {
            return message.reply('❌ Thời gian phải là số dương!');
        }
        
        let banDuration;
        let displayTime;
        
        switch (unit) {
            case 's': // giây
                banDuration = timeValue * 1000;
                displayTime = `${timeValue} giây`;
                break;
            case 'm': // phút
                banDuration = timeValue * 60 * 1000;
                displayTime = `${timeValue} phút`;
                break;
            case 'h': // giờ
                banDuration = timeValue * 60 * 60 * 1000;
                displayTime = `${timeValue} giờ`;
                break;
            case 'd': // ngày
                banDuration = timeValue * 356 * 60 * 60 * 1000;
                displayTime = `${timeValue} ngày`;
                break;
            default:
                return message.reply('❌ Đơn vị không hợp lệ! Sử dụng: s (giây), m (phút), h (giờ), d (ngày)');
        }
        
        // Kiểm tra giới hạn thời gian
        const MAX_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 ngày
        if (banDuration > MAX_DURATION) {
            return message.reply(`❌ Thời gian ban tối đa là 30 ngày!`);
        }
        
        // Tính thời gian ban đến
        const banUntil = Date.now() + banDuration;
        const banUntilDate = new Date(banUntil);
        
        // Thực hiện ban user
        const result = ai.firewall.banUserCustom(targetUserId, banUntil);
        
        if (!result) {
            return message.reply('❌ Không thể ban user này!');
        }
        
        try {
            // Lấy thông tin user để hiển thị
            const targetUser = await message.client.users.fetch(targetUserId).catch(() => null);
            const username = targetUser ? targetUser.tag : `Unknown (ID: ${targetUserId})`;
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚫 ĐÃ BAN USER')
                .addFields(
                    { name: '👤 User', value: username },
                    { name: '🆔 User ID', value: targetUserId },
                    { name: '⏳ Thời gian ban', value: displayTime },
                    { name: '🕒 Ban đến', value: banUntilDate.toLocaleString('vi-VN') },
                    { name: '👮 Ban bởi', value: message.author.tag },
                    { name: '📝 Lý do', value: 'Manual ban by owner' }
                )
                .setFooter({ text: 'Lol.AI Security System' })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
            Logger.error(`🚫 Owner ${message.author.tag} manually banned ${username} (${targetUserId}) for ${displayTime}`);
            
            // Gửi DM thông báo cho user bị ban (nếu có thể)
            if (targetUser) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🚫 BẠN ĐÃ BỊ BAN')
                        .setDescription('Tài khoản của bạn đã bị chặn sử dụng bot Lol.AI')
                        .addFields(
                            { name: '⏳ Thời gian ban', value: displayTime },
                            { name: '🕒 Hết hạn lúc', value: banUntilDate.toLocaleString('vi-VN') },
                            { name: '👮 Ban bởi', value: message.author.tag },
                            { name: '📝 Lý do', value: 'Manual ban by bot owner' },
                            { name: '📞 Kháng cáo', value: `Dùng lệnh \`.appeal <lý do>\` trong server hoặc liên hệ <@${Config.OWNER_ID}>` }
                        )
                        .setFooter({ text: 'Lol.AI Security System' })
                        .setTimestamp();
                    
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    Logger.warn(`Cannot send DM to banned user ${targetUserId}`);
                }
            }
            
            // Log audit
            ai.firewall.logAudit(
                message.author.id,
                `Manually banned ${targetUserId} for ${displayTime}`,
                'owner_manual_ban'
            );
            
        } catch (error) {
            Logger.error('Error in setban command:', error);
            await message.reply('❌ Đã có lỗi xảy ra khi ban user!');
        }
    }
};
