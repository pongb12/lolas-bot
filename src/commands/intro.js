const Config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'intro',
    description: '🤖 Giới thiệu về Lol.AI',
    usage: '.intro',
    
    async execute(message, args) {
        const embed = {
            color: 0xff3366,
            title: '🤖 **Lol.AI - theo mô hình của Google Gemini**',
            description: 'Xin chào! Tôi là trợ lý AI của server Lol 🎮',
            fields: [
                {
                    name: '🚀 Về tôi',
                    value: 'Tôi là **Lol.AI** - trợ lý AI sử dụng **Gemini** để phản hồi ',
                    inline: false
                },
                {
                    name: '🎮 Sử dụng',
                    value: `\`${Config.PREFIX}ask <câu hỏi>\` - Chat với AI\n\`${Config.PREFIX}clear\` - Xóa lịch sử\n\`${Config.PREFIX}ping\` - Kiểm tra tốc độ`,
                    inline: false
                }
            ],
            footer: { 
                text: `Được tạo cho server Lol | Phiên bản ${Config.BOT_VERSION} | Gemini❤`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'intro' bởi ${message.author.tag}`);
    }
};
