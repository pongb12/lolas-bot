const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

const MAX_DURATION = 365 * 24 * 60 * 60 * 1000; // 365 ngày (ms)

module.exports = {
    name: 'setban',
    description: '👑 Ban user theo thời gian tùy chỉnh (owner only)',
    usage: '.setban <userId> <số> <đơn vị (s/m/h/d)>',

    async execute(message, args) {
        /* ================= OWNER CHECK ================= */
        if (message.author.id !== Config.OWNER_ID) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Truy cập bị từ chối')
                        .setDescription('Chỉ **chủ bot** mới có quyền dùng lệnh này!')
                        .setTimestamp()
                ]
            });
        }

        /* ================= ARGUMENT CHECK ================= */
        if (args.length < 3) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('⚠️ Thiếu tham số')
                        .addFields(
                            { name: '📌 Cách dùng', value: '`.setban <userId> <số> <đơn vị>`' },
                            {
                                name: '🧪 Ví dụ',
                                value:
                                    '`.setban 123456789012345678 30 m`\n' +
                                    '`.setban 123456789012345678 2 h`\n' +
                                    '`.setban 123456789012345678 1 d`\n' +
                                    '`.setban 123456789012345678 300 s`'
                            },
                            {
                                name: '⏱️ Đơn vị',
                                value: 's = giây | m = phút | h = giờ | d = ngày'
                            }
                        )
                        .setTimestamp()
                ]
            });
        }

        const targetUserId = args[0];
        const timeValue = parseInt(args[1], 10);
        const unit = args[2].toLowerCase();

        /* ================= VALIDATE USER ID ================= */
        if (!/^\d{17,20}$/.test(targetUserId)) {
            return message.reply('❌ **User ID không hợp lệ** (17–20 chữ số)');
        }

        if (targetUserId === Config.OWNER_ID) {
            return message.reply('❌ Bạn không thể ban **chính mình**!');
        }

        /* ================= VALIDATE TIME ================= */
        if (isNaN(timeValue) || timeValue <= 0) {
            return message.reply('❌ Thời gian phải là **số nguyên dương**');
        }

        /* ================= CALCULATE DURATION ================= */
        let banDuration = 0;
        let displayTime = '';

        switch (unit) {
            case 's':
                banDuration = timeValue * 1000;
                displayTime = `${timeValue} giây`;
                break;
            case 'm':
                banDuration = timeValue * 60 * 1000;
                displayTime = `${timeValue} phút`;
                break;
            case 'h':
                banDuration = timeValue * 60 * 60 * 1000;
                displayTime = `${timeValue} giờ`;
                break;
            case 'd':
                banDuration = timeValue * 24 * 60 * 60 * 1000;
                displayTime = `${timeValue} ngày`;
                break;
            default:
                return message.reply('❌ Đơn vị không hợp lệ! Chỉ dùng **s / m / h / d**');
        }

        /* ================= LIMIT CHECK ================= */
        if (banDuration > MAX_DURATION) {
            return message.reply('❌ Thời gian ban tối đa là **365 ngày**');
        }

        /* ================= FETCH USER ================= */
        let targetUser = null;
        try {
            targetUser = await message.client.users.fetch(targetUserId);
            if (targetUser.bot) {
                return message.reply('❌ Không thể ban **bot**');
            }
        } catch {
            Logger.warn(`Cannot fetch user ${targetUserId}, continue banning`);
        }

        /* ================= BAN EXECUTE ================= */
        const banUntil = Date.now() + banDuration;
        const banUntilDate = new Date(banUntil);

        const success = ai.firewall.banUserCustom(targetUserId, banUntil);
        if (!success) {
            return message.reply('❌ Không thể ban user (firewall error)');
        }

        /* ================= EMBED RESPONSE ================= */
        const username = targetUser ? targetUser.tag : `Unknown (${targetUserId})`;

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚫 USER ĐÃ BỊ BAN')
            .addFields(
                { name: '👤 User', value: username },
                { name: '🆔 ID', value: targetUserId },
                { name: '⏳ Thời gian', value: displayTime },
                { name: '🕒 Ban đến', value: banUntilDate.toLocaleString('vi-VN') },
                { name: '👮 Thực hiện bởi', value: message.author.tag }
            )
            .setFooter({ text: 'Lol.AI Security System' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        /* ================= DM USER ================= */
        if (targetUser) {
            try {
                await targetUser.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('🚫 BẠN ĐÃ BỊ BAN')
                            .setDescription('Bạn đã bị chặn sử dụng bot **Lol.AI**')
                            .addFields(
                                { name: '⏳ Thời gian', value: displayTime },
                                { name: '🕒 Hết hạn', value: banUntilDate.toLocaleString('vi-VN') },
                                { name: '📞 Kháng cáo', value: `Liên hệ <@${Config.OWNER_ID}>` }
                            )
                            .setTimestamp()
                    ]
                });
            } catch {
                Logger.warn(`Cannot DM banned user ${targetUserId}`);
            }
        }

        /* ================= LOG ================= */
        Logger.error(
            `🚫 Owner ${message.author.tag} banned ${username} for ${displayTime}`
        );

        ai.firewall.logAudit(
            message.author.id,
            `Banned ${targetUserId} for ${displayTime}`,
            'owner_manual_ban'
        );
    }
};
