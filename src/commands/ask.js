const ai = require('../ai');
const Logger = require('../utils/logger');
const Config = require('../utils/config');

module.exports = {
    name: 'ask',
    description: '💬 Chat với Lol.AI',
    usage: '.ask <câu hỏi>',
    cooldown: Config.COOLDOWN_SECONDS,
    
    async execute(message, args, context = {}) {
        if (!args.length) {
            const reply = await message.reply(`Vui lòng nhập câu hỏi! Ví dụ: \`${Config.PREFIX}ask Chào Lol.AI!\``);
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        const question = args.join(' ');
        
        if (question.length > 2000) {
            return message.reply('❌ Câu hỏi quá dài! Giới hạn 2000 ký tự.');
        }

        message.channel.sendTyping();
        
        try {
            const response = await ai.askPublic(message.author.id, question);
            
            if (response.length > 1900) {
                await message.reply({
                    content: response.substring(0, 1900),
                    allowedMentions: { repliedUser: false }
                });
                
                const remaining = response.substring(1900);
                for (let i = 0; i < remaining.length; i += 1900) {
                    await message.channel.send(remaining.substring(i, i + 1900));
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
            await message.reply('❌ Đã xảy ra lỗi. Vui lòng thử lại!');
        }
    }
};
