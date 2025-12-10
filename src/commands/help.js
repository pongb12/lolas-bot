const config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'help',
    description: '❓ Hiển thị hướng dẫn sử dụng',
    usage: '.help [lệnh]',
    async execute(message, args) {
        const commands = [
            { name: 'ask', desc: '💬 Chat với Lol.AI', usage: '.ask <câu hỏi>' },
            { name: 'clear', desc: '🗑️ Xóa lịch sử chat', usage: '.clear' },
            { name: 'intro', desc: '🤖 Giới thiệu Lol.AI', usage: '.intro' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn này', usage: '.help [lệnh]' }
        ];

        // Nếu có tham số, hiển thị chi tiết lệnh
        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (cmd) {
                const embed = {
                    color: 0x0099ff,
                    title: `📖 Chi tiết lệnh: ${config.PREFIX}${cmd.name}`,
                    fields: [
                        {
                            name: 'Mô tả',
                            value: cmd.desc,
                            inline: false
                        },
                        {
                            name: 'Cách dùng',
                            value: `\`${cmd.usage}\``,
                            inline: false
                        },
                        {
                            name: 'Ví dụ',
                            value: `\`${cmd.usage.replace('<câu hỏi>', 'xin chào')}\``,
                            inline: false
                        }
                    ],
                    footer: {
                        text: `${config.BOT_NAME} v${config.BOT_VERSION}`
                    }
                };
                return message.reply({ embeds: [embed] });
            }
        }

        // Hiển thị toàn bộ lệnh
        const embed = {
            color: 0x7289da,
            title: `🤖 ${config.BOT_NAME} - Hướng dẫn sử dụng`,
            description: `Prefix: \`${config.PREFIX}\``,
            fields: commands.map(cmd => ({
                name: `${config.PREFIX}${cmd.name}`,
                value: `${cmd.desc}\n\`${cmd.usage}\``,
                inline: false
            })),
            footer: {
                text: `Dùng ${config.PREFIX}help <lệnh> để xem chi tiết | ${config.BOT_NAME} v${config.BOT_VERSION}`
            }
        };

        await message.reply({ embeds: [embed] });
        Logger.info(`[Command] help executed by ${message.author.tag}`);
    }
};
