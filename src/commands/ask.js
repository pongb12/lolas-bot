const gemini = require('../gemini');
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
            const quickReply = await message.reply('Vui lòng nhập câu hỏi! Ví dụ: `.ask Chào Lol.AI!`');
            setTimeout(() => quickReply.delete().catch(() => {}), 5000);
            return;
        }

        const question = args.join(' ');
        
        // Kiểm tra độ dài
        if (question.length > 1000) {
            return message.reply('❌ Câu hỏi quá dài! Giới hạn 1000 ký tự để tăng tốc độ.');
        }

        // Hiển thị "đang typing" ngay lập tức
        message.channel.sendTyping();
        
        try {
            // Gọi AI với timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Command timeout')), 15000)
            );
            
            const aiPromise = gemini.ask(message.author.id, question);
            const response = await Promise.race([aiPromise, timeoutPromise]);
            
            // Tối ưu: Chia nhỏ tin nhắn nhưng giữ nguyên định dạng
            if (response.length > 1900) {
                // Phần đầu với reply
                await message.reply({
                    content: response.substring(0, 1900),
                    allowedMentions: { repliedUser: false }
                });
                
                // Phần còn lại
                const remaining = response.substring(1900);
                for (let i = 0; i < remaining.length; i += 1900) {
                    await message.channel.send(remaining.substring(i, i + 1900));
                    // Nhấn typing để user biết bot còn đang gửi
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
            
            Logger.info(`✅ Command 'ask' bởi ${message.author.tag} (${question.length} chars)`);
            
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
