const Config = require('../utils/config');
const Logger = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: '❓ Hiển thị hướng dẫn sử dụng',
    usage: '.help [lệnh]',
    
    async execute(message, args) {
        const commands = [
            { name: 'ask', desc: '💬 Chat với Lol.AI', usage: '.ask <câu hỏi>' },
            { name: 'clear', desc: '🗑️ Xem và xóa lịch sử chat', usage: '.clear' },
            { name: 'intro', desc: '🤖 Giới thiệu về bot', usage: '.intro' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn này', usage: '.help [lệnh]' }
        ];

        // Hiển thị chi tiết một lệnh cụ thể
        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (cmd) {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📖 Lệnh: ${Config.PREFIX}${cmd.name}`)
                    .addFields(
                        { name: '📝 Mô tả', value: cmd.desc, inline: false },
                        { name: '🎯 Cách dùng', value: `\`${cmd.usage}\``, inline: false },
                        { name: '✨ Ví dụ', value: `\`${cmd.usage.replace('<câu hỏi>', 'Xin chào!')}\``, inline: false }
                    )
                    .setFooter({ text: `${Config.BOT_NAME} v${Config.BOT_VERSION} | Powered by DeepSeek` })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }
        }

        // Hiển thị tất cả lệnh
        const helpEmbed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(`🤖 ${Config.BOT_NAME} - Hướng dẫn`)
            .setDescription(`**Prefix:** \`${Config.PREFIX}\` | **AI Model:** DeepSeek | **Version:** \`${Config.BOT_VERSION}\``)
            .setFooter({ text: `Dùng ${Config.PREFIX}help <tên-lệnh> để xem chi tiết` })
            .setTimestamp();

        commands.forEach(cmd => {
            helpEmbed.addFields({
                name: `${Config.PREFIX}${cmd.name}`,
                value: `${cmd.desc}\n\`${cmd.usage}\``,
                inline: false
            });
        });

        await message.reply({ embeds: [helpEmbed] });
        Logger.info(`Command 'help' bởi ${message.author.tag}`);
    }
};
