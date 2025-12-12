const ai = require('../ai');
const Logger = require('../utils/logger');
const Config = require('../utils/config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'search',
    description: '🔍 Tìm kiếm thông tin với Lol.AI',
    usage: '.search <từ khóa/truy vấn>',
    cooldown: Config.COOLDOWN_SECONDS + 3, // Thêm cooldown cho search
    
    async execute(message, args) {
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔍 Lệnh Tìm Kiếm')
                .setDescription(`Dùng lệnh này để tìm kiếm thông tin chi tiết.`)
                .addFields(
                    { name: 'Cách dùng', value: `\`${Config.PREFIX}search <truy vấn>\``, inline: false },
                    { name: 'Ví dụ', value: `\`${Config.PREFIX}search thời tiết Hà Nội\`\n\`${Config.PREFIX}search cách làm bánh xèo\`\n\`${Config.PREFIX}search lịch sử Việt Nam\``, inline: false },
                    { name: '📝 Lưu ý', value: '• Tập trung vào thông tin thực tế\n• Có thể mất vài giây để xử lý\n• Kết quả được tổng hợp từ kiến thức AI', inline: false }
                )
                .setFooter({ text: 'Lol.AI Search Engine' });
            
            return message.reply({ embeds: [embed] });
        }

        const query = args.join(' ');
        
        if (query.length < 2) {
            return message.reply('❌ Truy vấn quá ngắn! Vui lòng nhập ít nhất 2 ký tự.');
        }
        
        if (query.length > 1000) {
            return message.reply('❌ Truy vấn quá dài! Giới hạn 1000 ký tự.');
        }

        message.channel.sendTyping();
        
        try {
            const response = await ai.search(message.author.id, query);
            
            const searchEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🔍 Kết Quả Tìm Kiếm')
                .setDescription(`**Truy vấn:** "${query}"`)
                .addFields(
                    { name: '📊 Thông tin tìm được', value: response.length > 1024 ? response.substring(0, 1020) + '...' : response, inline: false }
                )
                .setFooter({ 
                    text: `Lol.AI Search | Model: ${Config.GROQ_MODEL} | Kết quả có thể chưa đầy đủ`,
                    iconURL: 'https://cdn.discordapp.com/emojis/1065110910463193149.webp'
                })
                .setTimestamp();
            
            await message.reply({ embeds: [searchEmbed] });
            
            Logger.info(`✅ Command 'search' bởi ${message.author.tag} - Query: "${query.substring(0, 50)}..."`);
            
        } catch (error) {
            Logger.error('Command search error:', error.message);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Lỗi Tìm Kiếm')
                .setDescription('Đã xảy ra lỗi khi xử lý tìm kiếm. Vui lòng thử lại sau!')
                .setFooter({ text: 'Lol.AI Search Engine' });
            
            await message.reply({ embeds: [errorEmbed] });
        }
    }
};
