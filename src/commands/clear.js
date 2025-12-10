const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'clear',
    description: '🗑️ Xóa lịch sử chat',
    usage: '.clear',
    
    async execute(message, args) {
        const userHistory = gemini.getHistoryInfo(message.author.id);
        
        if (!userHistory.hasHistory) {
            const reply = await message.reply('Bạn chưa có lịch sử chat! 🤔');
            setTimeout(() => reply.delete().catch(() => {}), 3000);
            return;
        }
        
        gemini.clearHistory(message.author.id);
        
        const embed = {
            color: 0x00ff00,
            title: '✅ Đã xóa lịch sử!',
            description: `Đã xóa ${userHistory.totalMessages} tin nhắn.`,
            footer: { text: 'Bắt đầu cuộc trò chuyện mới với .ask' },
            timestamp: new Date()
        };
        
        await message.reply({ embeds: [embed] });
        Logger.info(`Command 'clear' bởi ${message.author.tag}`);
    }
};
