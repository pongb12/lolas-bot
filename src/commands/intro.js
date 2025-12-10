const BotConfig = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'intro',
    description: 'Giới thiệu về Lol.AI',
    usage: '.intro',
    async execute(message, args) {
        const embed = {
            color: 0xff3366,
            title: '**Lol.AI** - Trợ lý AI server Lol',
            description: 'Xin chào tất cả thành viên server Lol!',
            fields: [
                {
                    name: '👋 Về tôi',
                    value: 'Tôi là **Lol.AI** - AI riêng cho server Lol!',
                    inline: false
                },
                {
                    name: '💬 Chức năng',
                    value: '• Trò chuyện thông minh\n• Hỗ trợ giải đáp\n• Giúp đỡ thành viên\n• Mang lại không khí vui vẻ',
                    inline: false
                },
                {
                    name: '🎮 Sử dụng',
                    value: `Dùng lệnh \`${BotConfig.PREFIX}ask\` để chat!\nVí dụ: \`${BotConfig.PREFIX}ask Bạn khỏe không?\``,
                    inline: false
                }
            ],
            footer: {
                text: `Được tạo với ❤️ cho server Lol | Phiên bản ${BotConfig.BOT_VERSION}`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'intro' bởi ${message.author.tag}`);
    }
};
