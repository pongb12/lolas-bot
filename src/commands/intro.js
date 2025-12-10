const Config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'intro',
    description: '🤖 Giới thiệu về Lol.AI',
    usage: '.intro',
    
    async execute(message, args) {
        const embed = {
            color: 0xff3366,
            title: '**Lol.AI**',
            description: 'Xin chào! Tôi là AI của server Lol 🎮',
            thumbnail: {
                url: 'https://cdn.discordapp.com/emojis/1065110910463193149.webp'
            },
            fields: [
                {
                    name: '🚀 Về tôi',
                    value: 'Tôi là **Lol.AI** - trợ lý AI!',
                    inline: false
                },
                {
                    name: '🎮 Cách sử dụng',
                    value: `\`${Config.PREFIX}ask <câu hỏi>\` - Chat với AI\n\`${Config.PREFIX}clear\` - Xóa lịch sử\n\`${Config.PREFIX}ping\` - Kiểm tra tốc độ`,
                    inline: false
                },
                {
                    name: '🔧 Công nghệ',
                    value: `• **AI Engine**: Google Gemini ${Config.GEMINI_MODEL}\n• **Backend**: ???\n• **Hosting**: Meomaybe\n• **Speed**: -999999 <5s`,
                    inline: false
                }
            ],
            footer: { 
                text: `Được tạo với ❤️ cho server Lol | Phiên bản ${Config.BOT_VERSION} |V4.0.0`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'intro' bởi ${message.author.tag}`);
    }
};
