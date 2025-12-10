const config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'intro',
    description: 'Giới thiệu về Lol.AI',
    usage: '.intro',
    async execute(message, args) {
        const embed = {
            color: 0xff3366,
            title: '**Lol.AI** - Trợ lý AI của server Lol',
            description: 'Xin chào tất cả thành viên Lol!',
            thumbnail: {
                url: 'https://cdn.discordapp.com/emojis/1065110910463193149.webp'
            },
            fields: [
                {
                    name: '👋 Về tôi',
                    value: 'Tôi là **Lol.AI** - trợ lý AI được tạo riêng cho server Discord Lol!\nTôi luôn sẵn sàng trò chuyện và hỗ trợ các thành viên.',
                    inline: false
                },
                {
                    name: '💬 Chức năng chính',
                    value: '• Trò chuyện về mọi chủ đề\n• Hỗ trợ giải đáp thắc mắc\n• Giúp đỡ thành viên trong server\n• Mang lại không khí vui vẻ',
                    inline: false
                },
                {
                    name: '🎮 Cách sử dụng',
                    value: `Dùng lệnh \`${config.PREFIX}ask\` để chat với tôi!\nVí dụ: \`${config.PREFIX}ask Bạn có khỏe không?\``,
                    inline: false
                },
                {
                    name: '⚙️ Công nghệ',
                    value: '• **Backend:** ???\n• **AI Engine:** Google Gemini\n•',
                    inline: false
                }
            ],
            footer: {
                text: `Được tạo với ❤️ dành riêng cho server Lol | Phiên bản ${config.BOT_VERSION}`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`[Command] intro executed by ${message.author.tag}`);
    }
};
