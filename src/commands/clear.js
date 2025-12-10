const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'clear',
    description: '🗑️ Xóa lịch sử chat với Lol.AI',
    usage: '.clear',
    
    async execute(message, args) {
        const userHistory = gemini.getHistoryInfo(message.author.id);
        
        if (!userHistory.hasHistory) {
            const reply = await message.reply('Bạn chưa có lịch sử chat nào! 🤔');
            setTimeout(() => reply.delete().catch(() => {}), 3000);
            return;
        }
        
        const deleted = gemini.clearHistory(message.author.id);
        
        if (deleted) {
            const embed = {
                color: 0x00ff00,
                title: '✅ Đã xóa lịch sử!',
                description: `Đã xóa ${userHistory.totalMessages} tin nhắn trong lịch sử chat của bạn.`,
                footer: { 
                    text: 'Bắt đầu cuộc trò chuyện mới với .ask' 
                },
                timestamp: new Date()
            };
            
            await message.reply({ embeds: [embed] });
            Logger.info(`Command 'clear' bởi ${message.author.tag}`);
        }
    }
};
