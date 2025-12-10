const Config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'help',
    description: '❓ Hiển thị hướng dẫn',
    usage: '.help [lệnh]',
    
    async execute(message, args) {
        const commands = [
            { name: 'ask', desc: '💬 Chat với Lol.AI', usage: '.ask <câu hỏi>' },
            { name: 'clear', desc: '🗑️ Xóa lịch sử chat', usage: '.clear' },
            { name: 'intro', desc: '🤖 Giới thiệu bot', usage: '.intro' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn', usage: '.help [lệnh]' }
        ];

        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (cmd) {
                const embed = {
                    color: 0x0099ff,
                    title: `📖 Lệnh: ${Config.PREFIX}${cmd.name}`,
                    fields: [
                        { name: 'Mô tả', value: cmd.desc, inline: false },
                        { name: 'Cách dùng', value: `\`${cmd.usage}\``, inline: false },
                        { name: 'Ví dụ', value: `\`${cmd.usage.replace('<câu hỏi>', 'Xin chào')}\``, inline: false }
                    ],
                    footer: { text: `${Config.BOT_NAME} v${Config.BOT_VERSION}` }
                };
                return message.reply({ embeds: [embed] });
            }
        }

        const embed = {
            color: 0x7289da,
            title: `🤖 ${Config.BOT_NAME} - Lệnh`,
            description: `Prefix: \`${Config.PREFIX}\` | Model: \`${Config.GEMINI_MODEL}\``,
            fields: commands.map(cmd => ({
                name: `${Config.PREFIX}${cmd.name}`,
                value: `${cmd.desc}\n\`${cmd.usage}\``,
                inline: false
            })),
            footer: { 
                text: `Dùng ${Config.PREFIX}help <lệnh> để xem chi tiết`
            },
            timestamp: new Date()
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'help' bởi ${message.author.tag}`);
    }
};
