const Logger = require('../utils/logger');
const Config = require('../utils/config');

module.exports = {
    name: 'ping',
    description: '🏓 Kiểm tra độ trễ và tốc độ bot',
    usage: '.ping',
    
    async execute(message, args) {
        const startTime = Date.now();
        const sent = await message.reply('🏓 Đang đo tốc độ phản hồi...');
        
        const messageLatency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);
        const totalTime = Date.now() - startTime;
        
        // Đánh giá tốc độ
        let speedStatus = '🔴 Rất chậm';
        let speedEmoji = '🐌';
        
        if (totalTime < 100) {
            speedStatus = '✅ Siêu nhanh';
            speedEmoji = '⚡';
        } else if (totalTime < 300) {
            speedStatus = '✅ Nhanh';
            speedEmoji = '🚀';
        } else if (totalTime < 500) {
            speedStatus = '🟡 Bình thường';
            speedEmoji = '🐎';
        } else if (totalTime < 1000) {
            speedStatus = '🟠 Hơi chậm';
            speedEmoji = '🚶';
        }
        
        const embed = {
            color: totalTime < 300 ? 0x00ff00 : totalTime < 500 ? 0xffff00 : 0xff0000,
            title: `${speedEmoji} Pong! - Tốc độ hệ thống`,
            fields: [
                { 
                    name: '📶 Độ trễ tin nhắn', 
                    value: `\`${messageLatency}ms\``, 
                    inline: true 
                },
                { 
                    name: '🌐 Latency', 
                    value: `\`${apiLatency}ms\``, 
                    inline: true 
                },
                { 
                    name: '⏱️ Tổng thời gian xử lý', 
                    value: `\`${totalTime}ms\``, 
                    inline: true 
                },
                { 
                    name: '📊 Đánh giá tốc độ', 
                    value: `**${speedStatus}**`, 
                    inline: false 
                },
                { 
                    name: '🤖 Thông tin bot', 
                    value: `Model: \`${Config.GEMINI_MODEL}\`\nPrefix: \`${Config.PREFIX}\`\nPhiên bản: \`${Config.BOT_VERSION}\``, 
                    inline: false 
                }
            ],
            footer: { 
                text: 'Lol.AI - Sus' 
            },
            timestamp: new Date()
        };
        
        await sent.edit({ content: '', embeds: [embed] });
        Logger.info(`Command 'ping' bởi ${message.author.tag} - ${totalTime}ms`);
    }
};
