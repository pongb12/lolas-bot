const Config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'help',
    description: '❓ Hiển thị hướng dẫn sử dụng',
    usage: '.help [lệnh]',
    
    async execute(message, args) {
        const commands = [
            { name: 'ask', desc: '💬 Chat với Lol.AI', usage: '.ask <câu hỏi>' },
            { name: 'clear', desc: '🗑️ Xóa lịch sử chat', usage: '.clear' },
            { name: 'intro', desc: '🤖 Giới thiệu về Lol.AI', usage: '.intro' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ bot', usage: '.ping' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn này', usage: '.help [lệnh]' }
        ];

        // Hiển thị chi tiết một lệnh cụ thể
        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (cmd) {
                const embed = {
                    color: 0x0099ff,
                    title: `📖 Lệnh: ${Config.PREFIX}${cmd.name}`,
                    fields: [
                        { name: '📝 Mô tả', value: cmd.desc, inline: false },
                        { name: '🎯 Cách dùng', value: `\`${cmd.usage}\``, inline: false },
                        { name: '✨ Ví dụ', value: `\`${cmd.usage.replace('<câu hỏi>', 'Xin chào!')}\``, inline: false }
                    ],
                    footer: { 
                        text: `${Config.BOT_NAME} v${Config.BOT_VERSION} | Model: ${Config.GEMINI_MODEL}` 
                    },
                    timestamp: new Date()
                };
                return message.reply({ embeds: [embed] });
            }
        }

        // Hiển thị tất cả lệnh
        const embed = {
            color: 0x7289da,
            title: `🤖 ${Config.BOT_NAME} - Hướng dẫn nhanh`,
            description: `**Prefix:** \`${Config.PREFIX}\` | **Model:** \`${Config.GEMINI_MODEL}\` | **Phiên bản:** \`${Config.BOT_VERSION}\``,
            fields: commands.map(cmd => ({
                name: `${Config.PREFIX}${cmd.name}`,
                value: `${cmd.desc}\n\`${cmd.usage}\``,
                inline: false
            })),
            footer: { 
                text: `Dùng ${Config.PREFIX}help <tên-lệnh> để xem chi tiết |Lol.AI⭕`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'help' bởi ${message.author.tag}`);
    }
};
