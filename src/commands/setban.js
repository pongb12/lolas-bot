const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setban',
    description: '👑 Cài đặt thời gian ban (owner only)',
    usage: '.setban <số> <đơn vị (s/m/h/d)>',
    
    async execute(message, args) {
        // Chỉ owner mới được sử dụng
        if (message.author.id !== Config.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Truy cập bị từ chối')
                .setDescription('Chỉ chủ sở hữu bot mới có quyền cài đặt thời gian ban!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Thiếu thông tin')
                .setDescription('Vui lòng cung cấp thời gian và đơn vị!')
                .addFields(
                    { name: 'Cách dùng', value: '`.setban <số> <đơn vị>`' },
                    { name: 'Ví dụ', value: '`.setban 30 m` - Ban 30 phút\n`.setban 2 h` - Ban 2 giờ\n`.setban 1 d` - Ban 1 ngày' },
                    { name: 'Đơn vị hỗ trợ', value: 's = giây, m = phút, h = giờ, d = ngày' },
                    { name: 'Hiện tại', value: `${Config.BAN_DURATION/3600000} giờ` }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const timeValue = parseInt(args[0]);
        const unit = args[1].toLowerCase();
        
        if (isNaN(timeValue) || timeValue <= 0) {
            return message.reply('❌ Thời gian phải là số dương!');
        }
        
        let newDuration;
        let displayTime;
        
        switch (unit) {
            case 's': // giây
                newDuration = timeValue * 1000;
                displayTime = `${timeValue} giây`;
                break;
            case 'm': // phút
                newDuration = timeValue * 60 * 1000;
                displayTime = `${timeValue} phút`;
                break;
            case 'h': // giờ
                newDuration = timeValue * 60 * 60 * 1000;
                displayTime = `${timeValue} giờ`;
                break;
            case 'd': // ngày
                newDuration = timeValue * 24 * 60 * 60 * 1000;
                displayTime = `${timeValue} ngày`;
                break;
            default:
                return message.reply('❌ Đơn vị không hợp lệ! Sử dụng: s, m, h, d');
        }
        
        // Kiểm tra giới hạn thời gian (tối đa 30 ngày)
        const MAX_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 ngày
        if (newDuration > MAX_DURATION) {
            return message.reply(`❌ Thời gian ban tối đa là 30 ngày!`);
        }
        
        // Cập nhật trong firewall (runtime)
        ai.firewall.BAN_DURATION = newDuration;
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Đã cập nhật thời gian ban')
            .addFields(
                { name: '⏳ Thời gian mới', value: displayTime },
                { name: '📊 Thời lượng', value: `${newDuration} ms` },
                { name: '⚠️ Lưu ý', value: 'Thay đổi này chỉ có hiệu lực trong phiên hiện tại. Để thay đổi vĩnh viễn, cập nhật biến môi trường BAN_DURATION.' }
            )
            .setFooter({ text: '👑 Owner Command' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        Logger.warn(`👑 Owner ${message.author.tag} set ban duration to ${displayTime} (${newDuration}ms)`);
        
        // Ghi log thay đổi
        ai.firewall.logAudit(
            message.author.id,
            `Changed ban duration to ${displayTime}`,
            'owner_config_change'
        );
    }
};
