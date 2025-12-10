const gemini = require('../gemini');
const Logger = require('../utils/logger');

module.exports = {
    name: 'ask',
    description: '💬 Chat với Lol.AI',
    usage: '.ask <câu hỏi>',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Vui lòng nhập câu hỏi! Ví dụ: `.ask Chào bạn!`');
        }

        const question = args.join(' ');
        
        if (question.length > 2000) {
            return message.reply('Câu hỏi quá dài! Giới hạn 2000 ký tự.');
        }

        message.channel.sendTyping();
        
        try {
            const response = await gemini.ask(message.author.id, question);
            
            if (response.length > 1900) {
                const chunks = [];
                for (let i = 0; i < response.length; i += 1900) {
                    chunks.push(response.substring(i, i + 1900));
                }
                
                await message.reply({
                    content: chunks[0],
                    allowedMentions: { repliedUser: false }
                });
                
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            } else {
                await message.reply({
                    content: response,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            Logger.info(`Command 'ask' bởi ${message.author.tag}`);
            
        } catch (error) {
            Logger.error('Command ask error:', error);
            await message.reply('❌ Đã xảy ra lỗi khi xử lý yêu cầu.');
        }
    }
};
