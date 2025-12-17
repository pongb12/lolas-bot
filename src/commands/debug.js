// commands/debug.js
const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'debug',
    description: '👑 Debug tools for bot owner',
    usage: '.debug <mode>',
    
    async execute(message, args) {
        // Chỉ owner mới được sử dụng
        if (message.author.id !== Config.OWNER_ID) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Truy cập bị từ chối')
                .setDescription('Chỉ chủ sở hữu bot mới có quyền sử dụng lệnh này!')
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('👑 Owner Debug Menu')
                .setDescription('Công cụ debug dành cho chủ bot')
                .addFields(
                    { name: '.debug enable', value: 'Bật chế độ debug (bypass prompt firewall)' },
                    { name: '.debug disable', value: 'Tắt chế độ debug' },
                    { name: '.debug stats', value: 'Xem thống kê bảo mật' },
                    { name: '.debug test <question>', value: 'Test prompt firewall' },
                    { name: '.debug banned', value: 'Xem danh sách user bị chặn' }
                )
                .setFooter({ text: '⚠️ Cẩn thận khi test prompt security' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const subcommand = args[0].toLowerCase();
        
        try {
            switch (subcommand) {
                case 'enable':
                    const enableResult = ai.enableOwnerDebug(message.author.id);
                    await message.reply(`✅ ${enableResult}`);
                    Logger.warn(`👑 Owner ${message.author.tag} enabled debug mode`);
                    break;
                    
                case 'disable':
                    const disableResult = ai.disableOwnerDebug(message.author.id);
                    await message.reply(`✅ ${disableResult}`);
                    Logger.warn(`👑 Owner ${message.author.tag} disabled debug mode`);
                    break;
                    
                case 'stats':
                    const stats = ai.getSecurityStats(message.author.id);
                    
                    if (typeof stats === 'string') {
                        await message.reply(stats);
                    } else {
                        const embed = new EmbedBuilder()
                            .setColor(0x7289DA)
                            .setTitle('🛡️ Security Statistics')
                            .addFields(
                                { name: '🚫 Users Banned', value: stats.bannedUsers.toString(), inline: true },
                                { name: '📊 Recent Attempts', value: stats.recentAttempts.toString(), inline: true },
                                { name: '⚠️ Blocked Attempts', value: stats.blockedAttempts.toString(), inline: true }
                            )
                            .setFooter({ text: 'Lol.AI Security System' })
                            .setTimestamp();
                        
                        await message.reply({ embeds: [embed] });
                    }
                    break;
                    
                case 'test':
                    if (args.length < 2) {
                        return message.reply('❌ Vui lòng cung cấp câu hỏi để test!');
                    }
                    
                    const testQuestion = args.slice(1).join(' ');
                    const isLeakAttempt = ai.firewall.isPromptLeakAttempt(testQuestion);
                    
                    const resultEmbed = new EmbedBuilder()
                        .setColor(isLeakAttempt ? 0xFF0000 : 0x00FF00)
                        .setTitle('🔍 Prompt Firewall Test')
                        .addFields(
                            { name: '❓ Câu hỏi', value: testQuestion.substring(0, 100) },
                            { name: '🛡️ Phát hiện', value: isLeakAttempt ? '⚠️ **LEAK ATTEMPT DETECTED**' : '✅ **SAFE**' },
                            { name: '👑 Trạng thái', value: 'Owner - No ban applied' }
                        )
                        .setTimestamp();
                    
                    await message.reply({ embeds: [resultEmbed] });
                    Logger.warn(`👑 Owner test: "${testQuestion.substring(0, 30)}..." - Detected: ${isLeakAttempt}`);
                    break;
                    
                case 'banned':
                    // Lấy danh sách user bị chặn
                    const bannedList = Array.from(ai.firewall.bannedUsers.entries())
                        .map(([userId, banUntil]) => {
                            const timeLeft = banUntil - Date.now();
                            const hours = Math.floor(timeLeft / 3600000);
                            const minutes = Math.floor((timeLeft % 3600000) / 60000);
                            
                            return `• <@${userId}> - ${hours}h ${minutes}m còn lại`;
                        });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('🚫 Danh sách user bị chặn')
                        .setDescription(bannedList.length > 0 ? bannedList.join('\n') : '✅ Không có user nào bị chặn')
                        .addFields(
                            { name: 'Tổng số', value: bannedList.length.toString() }
                        )
                        .setTimestamp();
                    
                    await message.reply({ embeds: [embed] });
                    break;
                    
                default:
                    await message.reply('❌ Lệnh debug không hợp lệ. Dùng `.debug` để xem menu.');
            }
            
        } catch (error) {
            Logger.error('Lỗi debug command:', error);
            await message.reply('❌ Đã có lỗi xảy ra khi thực thi lệnh debug!');
        }
    }
};
