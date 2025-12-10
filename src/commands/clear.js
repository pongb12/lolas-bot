const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'clear',
    description: '🗑️ Xóa lịch sử chat với Lol.AI',
    usage: '.clear',
    async execute(message, args) {
        const userHistory = gemini.getHistoryInfo(message.author.id);
        
        if (!userHistory.hasHistory) {
            return message.reply('Bạn chưa có lịch sử chat nào để xóa! 🤔');
        }
        
        gemini.clearHistory(message.author.id);
        
        const embed = {
            color: 0x00ff00,
            title: '✅ Đã xóa lịch sử chat!',
            description: `Đã xóa ${userHistory.totalMessages} tin nhắn trong lịch sử chat của bạn với Lol.AI.`,
            footer: {
                text: 'Bạn có thể bắt đầu cuộc trò chuyện mới với .ask'
            }
        };
        
        await message.reply({ embeds: [embed] });
        Logger.info(`[Command] clear executed by ${message.author.tag}`);
    }
};
