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
            { name: 'feedbacks', desc: '📢 Gửi phản hồi cho tác giả', usage: '.feedbacks <nội dung>' },
            { name: 'appeal', desc: '📝 Gửi kháng cáo khi bị chặn', usage: '.appeal <lý do>' },
            { name: 'ping', desc: '🏓 Kiểm tra độ trễ', usage: '.ping' },
            { name: 'intro', desc: '🤖 Giới thiệu về bot', usage: '.intro' },
            { name: 'help', desc: '❓ Hiển thị hướng dẫn này', usage: '.help [lệnh]' }
            { name: 'security', desc: '⭕Check trạng thái của user/admin', usage: '.security' }
        ];

        const isOwner = message.author.id === Config.OWNER_ID;
        if (isOwner) {
            commands.push({
                name: 'unblock',
                desc: '🔓 Gỡ chặn user (Admin)',
                usage: '.unblock <userId>'
            });
        }

        if (args[0]) {
            const cmd = commands.find(c => c.name === args[0].toLowerCase());
            if (!cmd) {
                return message.reply(`❌ Không tìm thấy lệnh \`${args[0]}\``);
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📖 Lệnh: ${Config.PREFIX}${cmd.name}`)
                .addFields(
                    { name: '📝 Mô tả', value: cmd.desc },
                    { name: '🎯 Cách dùng', value: `\`${cmd.usage}\`` }
                )
                .setFooter({ text: `${Config.BOT_NAME} v${Config.BOT_VERSION}` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const helpEmbed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(`🤖 ${Config.BOT_NAME} - Hướng dẫn`)
            .setDescription(`Prefix: \`${Config.PREFIX}\` | Version: \`${Config.BOT_VERSION}\``)
            .setTimestamp();

        helpEmbed.addFields({
            name: '📋 Danh sách lệnh',
            value: commands
                .map(cmd => `**${Config.PREFIX}${cmd.name}**${cmd.name === 'unblock' ? ' *(Admin)*' : ''}\n${cmd.desc}`)
                .join('\n\n')
        });

        helpEmbed.addFields({
            name: '🌟 Tính năng',
            value:
                '🔒 Private Chat\n' +
                '🔍 Search thông tin\n' +
                '🗑️ Quản lý lịch sử\n' +
                '📢 Feedback & Appeal\n' +
                '🛡️ Bảo mật nâng cao'
        });

        if (isOwner) {
            helpEmbed.addFields({
                name: '🔐 Admin',
                value: 'Các lệnh quản trị chỉ hiển thị cho Owner.'
            });
        }

        await message.reply({ embeds: [helpEmbed] });
        Logger.info(`Help command by ${message.author.tag} (Owner: ${isOwner})`);
    }
};
