const Logger = require('../utils/logger');
const Config = require('../utils/config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'privatechat',
    description: '🔒 Tạo private chat riêng với Lol.AI',
    usage: '.privatechat',
    cooldown: 60, // 1 phút cooldown tránh spam tạo
    
    async execute(message, args, context = {}) {
        const { privateManager } = context;
        
        if (!message.guild) {
            return message.reply('❌ Lệnh này chỉ hoạt động trong Server!');
        }
        
        try {
            // Hiển thị trạng thái đang xử lý
            await message.channel.sendTyping();
            
            // Gọi Manager để tạo hoặc lấy channel cũ
            const channel = await privateManager.createPrivateChannel(message.guild, message.author);
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Private Chat Sẵn Sàng')
                .setDescription(`Kênh chat riêng của bạn: ${channel}`)
                .addFields(
                    { name: '⏳ Tự động xóa', value: 'Sau 1 giờ không nhắn tin', inline: true },
                    { name: '🚫 Cách xóa', value: `Dùng lệnh \`${Config.PREFIX}endprvchat\``, inline: true }
                )
                .setFooter({ text: 'Bấm vào kênh được tag ở trên để tham gia' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            Logger.error('CMD PrivateChat Error:', error);
            
            let errorMessage = '❌ Có lỗi xảy ra khi tạo kênh.';
            if (error.message.includes('đạt giới hạn')) {
                errorMessage = '⚠️ Server đã hết slot tạo Private Chat. Vui lòng chờ người khác dùng xong!';
            }
            
            await message.reply({ content: errorMessage, ephemeral: true });
        }
    }
};
