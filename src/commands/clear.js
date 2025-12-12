const deepseek = require('../ai');
const Logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    description: '🗑️ Xem và xóa lịch sử chat',
    usage: '.clear',
    
    async execute(message, args) {
        const userId = message.author.id;
        const userHistory = deepseek.getHistoryInfo(userId);
        
        // 1. Kiểm tra nếu không có lịch sử
        if (!userHistory.hasHistory) {
            return message.reply({
                content: '🤔 Bạn chưa có lịch sử chat nào để xóa!',
                ephemeral: true
            });
        }
        
        // 2. Lấy lịch sử để hiển thị
        const history = userHistory.history;
        
        // 3. Tạo embed hiển thị lịch sử
        const historyEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📜 Lịch sử chat của bạn')
            .setDescription(`Bạn có **${userHistory.totalMessages}** tin nhắn trong lịch sử.`)
            .setFooter({ text: 'Bạn có muốn xóa toàn bộ lịch sử này không?' })
            .setTimestamp();
        
        // Thêm 3 tin nhắn gần nhất vào embed
        const recentMessages = history.slice(-3);
        if (recentMessages.length > 0) {
            let historyText = '';
            recentMessages.forEach((msg, index) => {
                const role = msg.role === 'user' ? '👤 **Bạn:**' : '🤖 **Lol.AI:**';
                const shortText = msg.content.length > 80 
                    ? msg.content.substring(0, 80) + '...' 
                    : msg.content;
                historyText += `\n${role} ${shortText}\n`;
            });
            historyEmbed.addFields({
                name: 'Tin nhắn gần nhất:',
                value: historyText
            });
        }
        
        // 4. Tạo buttons xác nhận
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_clear_yes')
                    .setLabel('✅ Có, Xóa hết')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('confirm_clear_no')
                    .setLabel('❌ Không, Giữ lại')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💾')
            );
        
        // 5. Gửi tin nhắn xác nhận
        const confirmMessage = await message.reply({
            embeds: [historyEmbed],
            components: [confirmRow]
        });
        
        // 6. Collector cho buttons
        const filter = (interaction) => interaction.user.id === userId;
        const collector = confirmMessage.createMessageComponentCollector({ 
            filter, 
            time: 30000, // 30 giây
            max: 1
        });
        
        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'confirm_clear_yes') {
                // Xóa lịch sử
                deepseek.clearHistory(userId);
                
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Đã xóa lịch sử!')
                    .setDescription(`Đã xóa ${userHistory.totalMessages} tin nhắn.\nBạn có thể bắt đầu cuộc hội thoại mới với \`${message.client.config?.PREFIX || '.'}ask\`.`)
                    .setTimestamp();
                
                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });
                
                Logger.info(`Command 'clear' - ${message.author.tag} đã xóa lịch sử.`);
                
            } else if (interaction.customId === 'confirm_clear_no') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('💾 Đã giữ lại lịch sử')
                    .setDescription('Lịch sử chat của bạn vẫn được lưu giữ.')
                    .setTimestamp();
                
                await interaction.update({
                    embeds: [cancelEmbed],
                    components: []
                });
                
                Logger.info(`Command 'clear' - ${message.author.tag} đã hủy xóa.`);
            }
        });
        
        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏰ Hết thời gian xác nhận')
                    .setDescription('Lịch sử không bị xóa do không có phản hồi trong 30 giây.')
                    .setTimestamp();
                
                confirmMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                }).catch(() => {});
            }
        });
    }
};
