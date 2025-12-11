const gemini = require('../gemini');
const Logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); // Cần import

module.exports = {
    name: 'clear',
    description: '🗑️ Xem lịch sử và xóa chat với Lol.AI',
    usage: '.clear',
    
    async execute(message, args) {
        const userId = message.author.id;
        const userHistory = gemini.getHistoryInfo(userId);
        
        // 1. Kiểm tra nếu không có lịch sử
        if (!userHistory.hasHistory) {
            return message.reply('🤔 Bạn chưa có lịch sử chat nào để xóa!');
        }
        
        // 2. Lấy toàn bộ lịch sử để hiển thị
        const history = gemini.initUserHistory(userId);
        // Lọc bỏ 2 tin nhắn system prompt đầu tiên
        const userConversation = history.slice(2);
        
        // 3. Định dạng lịch sử để hiển thị (giới hạn độ dài)
        let historyPreview = `**Lịch sử chat gần đây của bạn (${userHistory.totalMessages} tin nhắn):**\n`;
        userConversation.slice(-5).forEach((msg, index) => { // Hiển thị 5 tin gần nhất
            const role = msg.role === 'user' ? '**Bạn:**' : '**Lol.AI:**';
            const shortText = msg.parts[0].text.length > 100 
                ? msg.parts[0].text.substring(0, 100) + '...' 
                : msg.parts[0].text;
            historyPreview += `\n${role} ${shortText}`;
        });
        historyPreview += `\n\nBạn có chắc chắn muốn **xóa toàn bộ** lịch sử này không?`;
        
        // 4. Tạo buttons xác nhận
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_clear_yes')
                    .setLabel('✅ Có, Xóa đi')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('confirm_clear_no')
                    .setLabel('❌ Không, Giữ lại')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        // 5. Gửi tin nhắn hỏi xác nhận
        const confirmMessage = await message.reply({
            content: historyPreview,
            components: [confirmRow]
        });
        
        // 6. Thu thập phản hồi từ button (chỉ từ user gốc)
        const filter = (interaction) => interaction.user.id === userId;
        const collector = confirmMessage.createMessageComponentCollector({ 
            filter, 
            time: 30000 // Hết hạn sau 30 giây
        });
        
        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'confirm_clear_yes') {
                // Xóa lịch sử
                gemini.clearHistory(userId);
                await interaction.update({
                    content: '🗑️ **Đã xóa lịch sử chat!** Bạn có thể bắt đầu cuộc hội thoại mới.',
                    components: [] // Xóa buttons
                });
                Logger.info(`Command 'clear' - ${message.author.tag} đã xác nhận xóa lịch sử.`);
            } else if (interaction.customId === 'confirm_clear_no') {
                await interaction.update({
                    content: '✅ **Đã giữ lại lịch sử chat.** Mọi thứ vẫn như cũ.',
                    components: []
                });
                Logger.info(`Command 'clear' - ${message.author.tag} đã hủy xóa lịch sử.`);
            }
            collector.stop(); // Dừng collector
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) {
                // Nếu hết giờ không ai nhấn, vô hiệu hóa buttons
                confirmMessage.edit({ 
                    content: `${historyPreview}\n\n⏰ **Đã hết thời gian xác nhận (30s).** Lịch sử không bị xóa.`,
                    components: [] 
                }).catch(() => {});
            }
        });
    }
};
