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
                    { name: '.debug test <question>', value: 'Test prompt firewall (regex)' },
                    { name: '.debug testml <question>', value: 'Test ML Llama Guard model' },
                    { name: '.debug health', value: 'Xem trạng thái hệ thống (include ML)' },
                    { name: '.debug mlstats', value: 'Xem thống kê ML model' },
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
                    
                case 'testml':
                    if (args.length < 2) {
                        return message.reply('❌ Vui lòng cung cấp câu hỏi để test ML!');
                    }
                    
                    const mlTestQuestion = args.slice(1).join(' ');
                    await message.reply('⏳ Đang chạy ML analysis...');
                    
                    try {
                        const mlResult = await ai.testPromptFirewallWithML(message.author.id, mlTestQuestion);
                        
                        const comparisonEmbed = new EmbedBuilder()
                            .setColor(mlResult.comparison.agree ? 0x00FF00 : 0xFFA500)
                            .setTitle('🦙 Llama Guard ML Analysis')
                            .addFields(
                                { name: '❓ Preview', value: mlResult.questionPreview.substring(0, 100), inline: false },
                                { name: '🤖 ML Result', value: `${mlResult.ml_analysis.safe ? '✅ SAFE' : '🚫 UNSAFE'} (confidence: ${(mlResult.ml_analysis.confidence || 0).toFixed(2)}, source: ${mlResult.ml_analysis.source})`, inline: true },
                                { name: '📋 Regex Result', value: `${mlResult.regex_analysis.safe ? '✅ SAFE' : '🚫 UNSAFE'} (${mlResult.regex_analysis.reason || 'no threat'})`, inline: true },
                                { name: '🔄 Agreement', value: mlResult.comparison.agree ? '✅ Both agree' : '⚠️ Disagreement detected', inline: false },
                                { name: '💾 ML Cache', value: mlResult.ml_analysis.cached ? '✅ From cache' : '🆕 Fresh result', inline: true }
                            )
                            .setFooter({ text: 'ML Model: meta-llama/llama-prompt-guard-2-86m' })
                            .setTimestamp();
                        
                        await message.reply({ embeds: [comparisonEmbed] });
                    } catch (e) {
                        Logger.error('ML test error:', e);
                        await message.reply(`❌ Lỗi khi test ML: ${e?.message || e}`);
                    }
                    break;
                    
                case 'health':
                    const health = ai.getSystemHealth();
                    const healthEmbed = new EmbedBuilder()
                        .setColor(0x36C5F0)
                        .setTitle('💊 System Health Check')
                        .addFields(
                            { name: '📊 AI Statistics', value: `Histories: ${health.ai.histories}\nContexts: ${health.ai.conversationContexts}\nCache: ${health.ai.cache}/${health.config.maxTokens}`, inline: true },
                            { name: '🛡️ Security', value: `Banned: ${health.security.bannedCount}\nAttempts: ${health.security.attemptsCount}\nThreshold: ${health.security.banThreshold}`, inline: true },
                            { name: '🦙 ML Status', value: `Status: ${health.ml.modelInitialized ? '✅ Ready' : '⏳ Loading'}\nCache: ${health.ml.cacheSize} entries\nTimeout: ${health.ml.modelTimeout}ms`, inline: true },
                            { name: '⚙️ Config', value: `Model: ${health.config.model}\nMax Tokens: ${health.config.maxTokens}\nReasoning: ${health.config.reasoningEnabled ? '✅' : '❌'}\nToken Compression: ${health.config.tokenCompressionEnabled ? '✅' : '❌'}`, inline: true },
                            { name: '⏰ Uptime', value: `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`, inline: true }
                        )
                        .setFooter({ text: 'Lol.AI v1.6.0 - ML Enhanced' })
                        .setTimestamp();
                    
                    await message.reply({ embeds: [healthEmbed] });
                    break;
                    
                case 'mlstats':
                    const mlStats = ai.firewall.getMLStats();
                    const mlStatsEmbed = new EmbedBuilder()
                        .setColor(0x9370DB)
                        .setTitle('🦙 ML Model Statistics')
                        .addFields(
                            { name: '📌 Status', value: `Initialized: ${mlStats.modelInitialized ? '✅ Yes' : '❌ No'}\nInitializing: ${mlStats.modelInitializing ? '🔄 Yes' : '❌ No'}`, inline: true },
                            { name: '💾 Cache', value: `Size: ${mlStats.cacheSize} entries\nDuration: ${mlStats.cacheDuration}ms (${Math.round(mlStats.cacheDuration / 60000)}m)`, inline: true },
                            { name: '⚡ Performance', value: `Init Timeout: ${mlStats.modelTimeout}ms\nMode: ${mlStats.enabled ? '🟢 ENABLED' : '🔴 DISABLED'}`, inline: false }
                        )
                        .setFooter({ text: 'Model: meta-llama/llama-prompt-guard-2-86m (ONNX quantized)' })
                        .setTimestamp();
                    
                    await message.reply({ embeds: [mlStatsEmbed] });
                    break;
                    
                default:
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
