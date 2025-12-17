const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setban',
    description: '👑 Ban user với thời gian tùy chỉnh (owner only)',
    usage: '.setban <user_id> <số> <đơn vị (s/m/h/d)> [lý do]',
    
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
        
        // Kiểm tra số lượng arguments
        if (args.length < 3) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Thiếu thông tin')
                .setDescription('Vui lòng cung cấp đầy đủ thông tin để ban user!')
                .addFields(
                    { name: 'Cách dùng', value: '`.setban <user_id> <số> <đơn vị> [lý do]`' },
                    { 
                        name: 'Ví dụ', 
                        value: '`.setban 123456789 30 m` - Ban 30 phút\n' +
                               '`.setban 123456789 2 h Spam` - Ban 2 giờ với lý do\n' +
                               '`.setban 123456789 1 d Vi phạm quy định` - Ban 1 ngày'
                    },
                    { name: 'Đơn vị hỗ trợ', value: '`s` = giây, `m` = phút, `h` = giờ, `d` = ngày' },
                    { name: '💡 Tip', value: 'Mention user hoặc dùng User ID đều được!' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Lấy user ID (từ mention hoặc ID trực tiếp)
        let userId = args[0];
        
        // Nếu là mention, extract ID
        if (userId.startsWith('<@') && userId.endsWith('>')) {
            userId = userId.slice(2, -1);
            if (userId.startsWith('!')) {
                userId = userId.slice(1);
            }
        }
        
        // Validate user ID
        if (!/^\d{17,20}$/.test(userId)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ User ID không hợp lệ')
                .setDescription('User ID phải là số có từ 17-20 chữ số!')
                .addFields(
                    { name: 'Ví dụ ID hợp lệ', value: '`123456789012345678`' },
                    { name: 'Hoặc mention', value: '<@123456789012345678>' }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        // Không cho phép ban owner
        if (userId === Config.OWNER_ID) {
            return message.reply('❌ Bạn không thể tự ban chính mình!');
        }
        
        // Parse thời gian
        const timeValue = parseInt(args[1]);
        const unit = args[2].toLowerCase();
        
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
                banDuration = timeValue * 24 * 60 * 60 * 1000;
                displayTime = `${timeValue} ngày`;
                break;
            default:
                return message.reply('❌ Đơn vị không hợp lệ! Sử dụng: `s`, `m`, `h`, `d`');
        }
        
        // Kiểm tra giới hạn thời gian (tối đa 30 ngày)
        const MAX_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 ngày
        if (banDuration > MAX_DURATION) {
            return message.reply('❌ Thời gian ban tối đa là 30 ngày!');
        }
        
        // Lấy lý do (nếu có)
        const reason = args.slice(3).join(' ') || 'Không có lý do cụ thể';
        
        try {
            // Lấy thông tin user
            const targetUser = await message.client.users.fetch(userId).catch(() => null);
            const userTag = targetUser ? targetUser.tag : `Unknown User (${userId})`;
            
            // Kiểm tra user đã bị ban chưa
            const isAlreadyBanned = ai.isUserBlocked(userId);
            
            // Ban user với thời gian tùy chỉnh
            const result = ai.firewall.banUserCustom(userId, banDuration, reason);
            
            if (!result.success) {
                return message.reply(`❌ Không thể ban user: ${result.message}`);
            }
            
            // Tính thời gian hết hạn ban
            const banExpiresAt = new Date(Date.now() + banDuration);
            
            // Tạo embed thông báo cho owner
            const ownerEmbed = new EmbedBuilder()
                .setColor(isAlreadyBanned ? 0xFFA500 : 0xFF0000)
                .setTitle(isAlreadyBanned ? '⚠️ Đã cập nhật ban' : '🔨 Đã ban user')
                .setDescription(isAlreadyBanned ? 'User đã bị ban trước đó, thời gian ban đã được cập nhật.' : 'User đã bị ban thành công!')
                .addFields(
                    { name: '👤 User', value: `${userTag}\nID: \`${userId}\``, inline: true },
                    { name: '⏱️ Thời gian ban', value: displayTime, inline: true },
                    { name: '⏰ Hết hạn lúc', value: banExpiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), inline: false },
                    { name: '📝 Lý do', value: reason },
                    { name: '👨‍💼 Ban bởi', value: message.author.tag }
                )
                .setFooter({ text: '👑 Owner Command' })
                .setTimestamp();
            
            await message.reply({ embeds: [ownerEmbed] });
            
            // Gửi DM thông báo cho user bị ban (nếu có thể)
            if (targetUser) {
                const userEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚫 Bạn đã bị tạm thời chặn')
                    .setDescription('Tài khoản của bạn đã bị chặn sử dụng bot.')
                    .addFields(
                        { name: '⏱️ Thời gian ban', value: displayTime },
                        { name: '⏰ Hết hạn lúc', value: banExpiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) },
                        { name: '📝 Lý do', value: reason },
                        { name: '📢 Kháng cáo', value: 'Nếu bạn cho rằng đây là nhầm lẫn, hãy sử dụng lệnh `.appeal <lý do>` để gửi kháng cáo.' }
                    )
                    .setTimestamp();
                
                await targetUser.send({ embeds: [userEmbed] }).catch((err) => {
                    Logger.warn(`Không thể gửi DM cho user ${userId}:`, err.message);
                });
            }
            
            // Logging
            Logger.warn(`🔨 Owner ${message.author.tag} banned user ${userTag} (${userId}) for ${displayTime}. Reason: ${reason}`);
            
            // Audit log
            if (ai.firewall.logAudit) {
                ai.firewall.logAudit(
                    message.author.id,
                    `Banned user ${userId} for ${displayTime}. Reason: ${reason}`,
                    'manual_ban'
                );
            }
            
        } catch (error) {
            Logger.error('Lỗi khi ban user:', error);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi')
                .setDescription('Đã có lỗi xảy ra khi ban user!')
                .addFields(
                    { name: '⚠️ Chi tiết', value: error.message || 'Lỗi không xác định' }
                )
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
        }
    }
};
