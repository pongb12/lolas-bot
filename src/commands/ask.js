const deepseek = require('../deepseek');
const Logger = require('../utils/logger');
const Config = require('../utils/config');

module.exports = {
    name: 'ask',
    description: '💬 Chat với Lol.AI',
    usage: '.ask <câu hỏi>',
    cooldown: Config.COOLDOWN_SECONDS,
    
    async execute(message, args) {
        // Kiểm tra nhanh
        if (!args.length) {
            const reply = await message.reply('Vui lòng nhập câu hỏi! Ví dụ: `.ask Chào Lol.AI!`');
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        const question = args.join(' ');
        
        // Kiểm tra độ dài
        if (question.length > 2000) {
            return message.reply('❌ Câu hỏi quá dài! Giới hạn 2000 ký tự.');
        }

        // Hiển thị "đang typing"
        message.channel.sendTyping();
        
        try {
            // Gọi AI với timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Command timeout')), 30000)
            );
            
            const aiPromise = deepseek.ask(message.author.id, question);
            const response = await Promise.race([aiPromise, timeoutPromise]);
            
            // Chia nhỏ tin nhắn nếu quá dài
            if (response.length > 1900) {
                // Phần đầu
                await message.reply({
                    content: response.substring(0, 1900),
                    allowedMentions: { repliedUser: false }
                });
                
                // Phần còn lại
                const remaining = response.substring(1900);
                for (let i = 0; i < remaining.length; i += 1900) {
                    await message.channel.send(remaining.substring(i, i + 1900));
                    if (i + 1900 < remaining.length) {
                        message.channel.sendTyping();
                    }
                }
            } else {
                await message.reply({
                    content: response,
                    allowedMentions: { repliedUser: false }
                });
            }
            
            Logger.info(`✅ Command 'ask' bởi ${message.author.tag}`);
            
        } catch (error) {
            Logger.error('Command ask error:', error.message);
            
            if (error.message.includes('timeout')) {
                await message.reply('⏰ **Bot phản hồi chậm!** Vui lòng thử lại câu hỏi ngắn hơn.');
            } else {
                await message.reply('❌ Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau!');
            }
        }
    }
};
