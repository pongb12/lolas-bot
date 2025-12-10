const Logger = require('../utils/logger');

module.exports = {
    name: 'ping',
    description: '🏓 Kiểm tra độ trễ',
    usage: '.ping',
    async execute(message, args) {
        const sent = await message.reply('🏓 Đang tính ping...');
        
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);
        
        const embed = {
            color: 0x00ff00,
            title: '🏓 Pong!',
            fields: [
                { name: '📶 Độ trễ tin nhắn', value: `\`${latency}ms\``, inline: true },
                { name: '🌐 Latency', value: `\`${apiLatency}ms\``, inline: true },
                { 
                    name: '📊 Trạng thái', 
                    value: latency < 200 ? '✅ Tốt' : latency < 500 ? '⚠️ Bình thường' : '🔴 Chậm', 
                    inline: true 
                }
            ],
            footer: { text: 'Lol.AI - Luôn sẵn sàng!' },
            timestamp: new Date()
        };
        
        await sent.edit({ content: '', embeds: [embed] });
        Logger.info(`Command 'ping' bởi ${message.author.tag}`);
    }
};
