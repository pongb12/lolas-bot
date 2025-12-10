const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'clear',
    description: '🗑️ Xóa lịch sử chat',
    usage: '.clear',
    async execute(message, args) {
        const userHistory = gemini.getHistoryInfo(message.author.id);
        
        if (!userHistory.hasHistory) {
            return message.reply('Bạn chưa có lịch sử chat nào! 🤔');
        }
        
        gemini.clearHistory(message.author.id);
        
        const embed = {
            color: 0x00ff00,
            title: '✅ Đã xóa lịch sử!',
            description: `Đã xóa ${userHistory.totalMessages} tin nhắn trong lịch sử.`,
            footer: { text: 'Bắt đầu cuộc trò chuyện mới với .ask' }
        };
        
        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'clear' bởi ${message.author.tag}`);
    }
};
