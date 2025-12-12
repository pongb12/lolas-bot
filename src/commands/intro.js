const Config = require('../utils/config');
const Logger = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'intro',
    description: '🤖 Giới thiệu về Lol.AI',
    usage: '.intro',
    
    async execute(message, args) {
        const introEmbed = new EmbedBuilder()
            .setColor(0xFF3366)
            .setTitle('🤖 **Lol.AI - Trợ lý AI với Groq**')
            .setDescription('Xin chào! Tôi là trợ lý AI chính thức của server Lol 🎮')
            .addFields(
                {
                    name: '🚀 Về tôi',
                    value: 'Tôi là **Lol.AI** - trợ lý AI sử dụng **Groq**🤑',
                    inline: false
                },
                {
                    name: '🎮 Cách sử dụng',
                    value: `\`${Config.PREFIX}ask <câu hỏi>\` - Chat với AI\n\`${Config.PREFIX}clear\` - Xem & xóa lịch sử\n\`${Config.PREFIX}ping\` - Kiểm tra tốc độ`,
                    inline: false
                },
            )
            .setFooter({ 
                text: `Được tạo với ❤️ cho server Lol | Phiên bản ${Config.BOT_VERSION} | Powered by Groq`
            })
            .setTimestamp()
            .setThumbnail('https://cdn.discordapp.com/emojis/1065110910463193149.webp');

        await message.reply({ embeds: [introEmbed] });
        Logger.info(`Command 'intro' bởi ${message.author.tag}`);
    }
};
