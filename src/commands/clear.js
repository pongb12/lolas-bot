const ai = require('../ai');
const Logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    description: '🗑️ Xem và xóa lịch sử chat',
    usage: '.clear',

    async execute(message, args) {
        const userId = message.author.id;

        // Lấy history từ AIHandler
        const historyInfo = ai.getHistoryInfo(userId);

        const publicHistory = historyInfo.public.history || [];
        const privateHistory = historyInfo.private.history || [];

        const totalMessages = publicHistory.length + privateHistory.length;

        // 1. Không có lịch sử
        if (totalMessages === 0) {
            return message.reply('🤔 Bạn chưa có lịch sử chat nào để xóa!');
        }

        // Lấy 3 tin nhắn gần nhất (ưu tiên private)
        const combined = [...privateHistory, ...publicHistory];
        const recent = combined.slice(-3);

        // 2. Tạo embed hiển thị
        const historyEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📜 Lịch sử chat của bạn')
            .setDescription(`Bạn có **${totalMessages}** tin nhắn trong lịch sử (public + private).`)
            .setFooter({ text: 'Bạn chắc chắn muốn xóa toàn bộ lịch sử?' })
            .setTimestamp();

        if (recent.length > 0) {
            let historyText = recent.map(msg => {
                const role = msg.role === 'user' ? '👤 **Bạn:**' : '🤖 **Lol.AI:**';
                const text = msg.content.length > 80 
                    ? msg.content.substring(0, 80) + '...' 
                    : msg.content;

                return `${role} ${text}`;
            }).join("\n");

            historyEmbed.addFields({
                name: '3 tin nhắn gần nhất:',
                value: historyText
            });
        }

        // 3. Buttons xác nhận
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_clear_yes')
                    .setLabel('✅ Có, xóa tất cả')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('confirm_clear_no')
                    .setLabel('❌ Không, giữ lại')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💾')
            );

        const confirmMessage = await message.reply({
            embeds: [historyEmbed],
            components: [confirmRow]
        });

        // 4. Collector
        const filter = (i) => i.user.id === userId;
        const collector = confirmMessage.createMessageComponentCollector({
            filter,
            time: 30000,
            max: 1
        });

        collector.on('collect', async (interaction) => {
            // XÓA
            if (interaction.customId === 'confirm_clear_yes') {
                const result = ai.clearAllHistory(userId); // sử dụng hàm đúng trong AIHandler

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Đã xóa toàn bộ lịch sử!')
                    .setDescription(`Đã xóa **${totalMessages}** tin nhắn (public + private).`)
                    .setTimestamp();

                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                }).catch(() => {});

                Logger.info(`Command 'clear' - ${message.author.tag} đã xóa toàn bộ lịch sử.`);
            }

            // HỦY
            else {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('💾 Đã giữ lại lịch sử')
                    .setDescription('Không có gì bị xóa.')
                    .setTimestamp();

                await interaction.update({
                    embeds: [cancelEmbed],
                    components: []
                }).catch(() => {});

                Logger.info(`Command 'clear' - ${message.author.tag} đã hủy xóa.`);
            }
        });

        // 5. Hết thời gian
        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏰ Hết thời gian xác nhận')
                    .setDescription('Không có phản hồi trong 30 giây.')
                    .setTimestamp();

                confirmMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => {});
            }
        });
    }
};
