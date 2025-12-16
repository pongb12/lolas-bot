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
            { name: 'feedbacks', desc: '📢 Gửi phản hồi cho devs', usage: '.feedbacks <nội dung>' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'intro', desc: '🤖 Giới thiệu về bot', usage: '.intro' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn này', usage: '.help [lệnh]' }
        ];

        // Hiển thị chi tiết một lệnh
        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (cmd) {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📖 Lệnh: ${Config.PREFIX}${cmd.name}`)
                    .addFields(
                        { name: '📝 Mô tả', value: cmd.desc },
                        { name: '🎯 Cách dùng', value: `\`${cmd.usage}\`` },
                        { name: '✨ Ví dụ', value: `\`${cmd.usage.replace('<câu hỏi>', 'Xin chào!').replace('<truy vấn>', 'thời tiết').replace('<nội dung>', 'Bot rất hay!')}\`` }
                    )
                    .setFooter({ text: `${Config.BOT_NAME} v${Config.BOT_VERSION} | Model: Groq` })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            } else {
                return message.reply(`❌ Không tìm thấy lệnh \`${args[0]}\``);
            }
        }

        // Hiển thị danh sách lệnh
        const helpEmbed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(`🤖 ${Config.BOT_NAME} - Hướng dẫn đầy đủ`)
            .setDescription(`**Prefix:** \`${Config.PREFIX}\` | **AI Model:** Groq | **Version:** \`${Config.BOT_VERSION}\``)
            .setFooter({ text: `Dùng ${Config.PREFIX}help <tên-lệnh> để xem chi tiết` })
            .setTimestamp();

        const midIndex = Math.ceil(commands.length / 2);
        const firstColumn = commands.slice(0, midIndex);
        const secondColumn = commands.slice(midIndex);

        helpEmbed.addFields({
            name: '📋 Lệnh Cơ Bản',
            value: firstColumn.map(cmd => `**${Config.PREFIX}${cmd.name}**\n${cmd.desc}\n\`${cmd.usage}\``).join('\n\n'),
            inline: true
        });

        helpEmbed.addFields({
            name: '📋 Lệnh Nâng Cao',
            value: secondColumn.map(cmd => `**${Config.PREFIX}${cmd.name}**\n${cmd.desc}\n\`${cmd.usage}\``).join('\n\n'),
            inline: true
        });

        helpEmbed.addFields({
            name: '🌟 Tính năng mới',
            value: '🔒 **Private Chat**: Chat riêng trong server\n🔍 **Search**: Tìm kiếm thông tin chi tiết\n🗑️ **Clear**: Quản lý lịch sử chat\n📢 **Feedbacks**: Gửi phản hồi trực tiếp cho tác giả'
        });

        await message.reply({ embeds: [helpEmbed] });
        Logger.info(`Command 'help' bởi ${message.author.tag}`);
    }
};
