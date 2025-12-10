const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'ask',
    description: '💬 Chat với Lol.AI',
    usage: '.ask <câu hỏi>',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Vui lòng nhập câu hỏi! Ví dụ: `.ask Chào bạn, bạn là ai?`');
        }

        const question = args.join(' ');
        
        // Kiểm tra độ dài
        if (question.length > 2000) {
            return message.reply('Câu hỏi quá dài! Vui lòng giới hạn trong 2000 ký tự.');
        }

        // Hiển thị typing
        message.channel.sendTyping();
        
        try {
            const response = await gemini.ask(message.author.id, question);
            
            // Chia nhỏ response nếu quá dài
            if (response.length > 1900) {
                const chunks = [];
                for (let i = 0; i < response.length; i += 1900) {
                    chunks.push(response.substring(i, i + 1900));
                }
                
                // Gửi phần đầu với reply
                await message.reply({
                    content: chunks[0],
                    allowedMentions: { repliedUser: false }
                });
                
                // Gửi các phần còn lại
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            } else {
                await message.reply({
                    content: response,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            Logger.info(`[Command] ask executed by ${message.author.tag}`);
            
        } catch (error) {
            Logger.error('[Command ask] Lỗi:', error);
            await message.reply('❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn.');
        }
    }
};
