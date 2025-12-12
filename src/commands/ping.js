const Logger = require('../utils/logger');
const Config = require('../utils/config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: '🏓 Kiểm tra độ trễ và tốc độ',
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
        let color = 0xFF0000;
        
        if (totalTime < 100) {
            speedStatus = '✅ Siêu nhanh';
            speedEmoji = '⚡';
            color = 0x00FF00;
        } else if (totalTime < 300) {
            speedStatus = '✅ Nhanh';
            speedEmoji = '🚀';
            color = 0x00FF00;
        } else if (totalTime < 500) {
            speedStatus = '🟡 Bình thường';
            speedEmoji = '🐎';
            color = 0xFFFF00;
        } else if (totalTime < 1000) {
            speedStatus = '🟠 Hơi chậm';
            speedEmoji = '🚶';
            color = 0xFFA500;
        }
        
        const pingEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${speedEmoji} Pong! - Tốc độ hệ thống`)
            .addFields(
                { name: '📶 Độ trễ tin nhắn', value: `\`${messageLatency}ms\``, inline: true },
                { name: '🌐 Latency', value: `\`${apiLatency}ms\``, inline: true },
                { name: '⏱️ Tổng thời gian', value: `\`${totalTime}ms\``, inline: true },
                { name: '📊 Đánh giá tốc độ', value: `**${speedStatus}**`, inline: false },
                { 
                    name: '🤖 Thông tin bot', 
                    value: `AI: \`DeepSeek\`\nPrefix: \`${Config.PREFIX}\`\nPhiên bản: \`${Config.BOT_VERSION}\``, 
                    inline: false 
                }
            )
            .setFooter({ text: 'Lol.AI - Powered by Groq' })
            .setTimestamp();
        
        await sent.edit({ content: '', embeds: [pingEmbed] });
        Logger.info(`Command 'ping' bởi ${message.author.tag} - ${totalTime}ms`);
    }
};
