const Config = require('../utils/config');
const Logger = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: '❓ Hiển thị hướng dẫn sử dụng',
    usage: '.help [lệnh]',
    
    async execute(message, args) {
        const commands = [
            { name: 'ask', desc: '💬 Chat công khai với Lol.AI', usage: '.ask <câu hỏi>' },
            { name: 'search', desc: '🔍 Tìm kiếm thông tin chi tiết', usage: '.search <truy vấn>' },
            { name: 'privatechat', desc: '🔒 Tạo private chat riêng', usage: '.privatechat' },
            { name: 'endprvchat', desc: '🚫 Kết thúc private chat', usage: '.endprvchat' },
            { name: 'clear', desc: '🗑️ Xem và xóa lịch sử chat', usage: '.clear' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'intro', desc: '🤖 Giới thiệu về bot', usage: '.intro' },
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
                        { name: '✨ Ví dụ', value: `\`${cmd.usage.replace('<câu hỏi>', 'Xin chào!').replace('<truy vấn>', 'thời tiết')}\``, inline: false }
                    )
                    .setFooter({ text: `${Config.BOT_NAME} v${Config.BOT_VERSION} | Model: ${Config.GROQ_MODEL}` })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }
        }

        // Hiển thị tất cả lệnh
        const helpEmbed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(`🤖 ${Config.BOT_NAME} - Hướng dẫn đầy đủ`)
            .setDescription(`**Prefix:** \`${Config.PREFIX}\` | **AI Model:** \`${Config.GROQ_MODEL}\` | **Version:** \`${Config.BOT_VERSION}\``)
            .setFooter({ text: `Dùng ${Config.PREFIX}help <tên-lệnh> để xem chi tiết` })
            .setTimestamp();

        // Chia commands thành 2 cột
        const midIndex = Math.ceil(commands.length / 2);
        const firstColumn = commands.slice(0, midIndex);
        const secondColumn = commands.slice(midIndex);

        helpEmbed.addFields({
            name: '📋 Lệnh Cơ Bản',
            value: firstColumn.map(cmd => `**${Config.PREFIX}${cmd.name}**\n${cmd.desc}\n\`${cmd.usage}\`\n`).join('\n'),
            inline: true
        });

        helpEmbed.addFields({
            name: '📋 Lệnh Nâng Cao',
            value: secondColumn.map(cmd => `**${Config.PREFIX}${cmd.name}**\n${cmd.desc}\n\`${cmd.usage}\`\n`).join('\n'),
            inline: true
        });

        helpEmbed.addFields({
            name: '🌟 Tính năng mới',
            value: '🔒 **Private Chat**: Chat riêng trong server\n🔍 **Search**: Tìm kiếm thông tin chi tiết\n🗑️ **Clear**: Quản lý lịch sử chat\n',
            inline: false
        });

        await message.reply({ embeds: [helpEmbed] });
        Logger.info(`Command 'help' bởi ${message.author.tag}`);
    }
};
