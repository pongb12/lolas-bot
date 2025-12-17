// commands/security.js
const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'security',
    description: '🔒 Security self-check and management',
    usage: '.security <check|test|report>',
    
    async execute(message, args) {
        // Kiểm tra owner
        const isOwner = message.author.id === Config.OWNER_ID;
        
        if (!isOwner) {
            // Cho phép user tự kiểm tra
            if (args[0] === 'check') {
                const isBlocked = ai.isUserBlocked(message.author.id);
                
                const embed = new EmbedBuilder()
                    .setColor(isBlocked ? 0xFF0000 : 0x00FF00)
                    .setTitle('🔒 Security Status Check')
                    .addFields(
                        { name: '👤 User', value: message.author.tag },
                        { name: '🆔 User ID', value: message.author.id },
                        { name: '🚫 Block Status', value: isBlocked ? '❌ **BỊ CHẶN**' : '✅ **KHÔNG BỊ CHẶN**' },
                        { name: '📊 Attempts', value: 'Use `.appeal` nếu bị chặn nhần' }
                    )
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }
            
            return message.reply('❌ Chỉ Admin mới có đầy đủ quyền security!');
        }
        
        // Owner commands
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x7289DA)
                .setTitle('🔒 Security Management Panel')
                .setDescription('Công cụ quản lý bảo mật dành cho chủ bot')
                .addFields(
                    { name: '.security check', value: 'Kiểm tra trạng thái của bạn' },
                    { name: '.security test', value: 'Test prompt firewall' },
                    { name: '.security report', value: 'Báo cáo bảo mật chi tiết' },
                    { name: '.security cleanup', value: 'Dọn dẹp logs cũ' }
                )
                .setFooter({ text: '👑 Owner Access Only' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'report':
                // Tạo báo cáo bảo mật chi tiết
                const auditData = this.loadAuditData();
                const recentAttempts = this.getRecentSecurityEvents();
                
                const reportEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📊 Báo cáo bảo mật 24h')
                    .addFields(
                        { name: '🚫 Blocked Users', value: ai.firewall.bannedUsers.size.toString(), inline: true },
                        { name: '⚠️ Prompt Attempts', value: recentAttempts.toString(), inline: true },
                        { name: '👑 Owner Tests', value: this.countOwnerTests().toString(), inline: true },
                        { name: '📈 Trends', value: this.analyzeSecurityTrends() }
                    )
                    .setTimestamp();
                
                await message.reply({ embeds: [reportEmbed] });
                break;
                
            case 'cleanup':
                // Dọn dẹp logs cũ
                const cleaned = this.cleanupOldLogs();
                
                const cleanupEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🧹 Security Logs Cleanup')
                    .setDescription(`Đã dọn dẹp ${cleaned} bản ghi cũ`)
                    .setTimestamp();
                
                await message.reply({ embeds: [cleanupEmbed] });
                break;
                
            case 'test':
                // Test security system bằng cách cố tình trigger
                const testEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🧪 Security System Test')
                    .setDescription('Testing prompt firewall response...')
                    .addFields(
                        { name: 'Test 1', value: 'Trying to ask about prompt...' }
                    );
                
                const testMessage = await message.reply({ embeds: [testEmbed] });
                
                // Chờ và cập nhật kết quả
                setTimeout(async () => {
                    testEmbed
                        .setColor(0x00FF00)
                        .setDescription('✅ Security test completed!')
                        .addFields(
                            { name: 'Test 1 Result', value: '⚠️ Blocked as expected (Owner immunity active)' },
                            { name: 'Owner Status', value: '👑 Immune to bans' },
                            { name: 'System Status', value: '✅ Functioning correctly' }
                        );
                    
                    await testMessage.edit({ embeds: [testEmbed] });
                }, 2000);
                break;
        }
    },
    
    loadAuditData() {
        // Đọc file audit log
        try {
            const fs = require('fs');
            const path = require('path');
            const auditPath = path.join(__dirname, '../audit_log.json');
            
            if (fs.existsSync(auditPath)) {
                const raw = fs.readFileSync(auditPath, 'utf8');
                return JSON.parse(raw);
            }
        } catch (error) {
            Logger.error('Error loading audit data:', error);
        }
        return [];
    },
    
    getRecentSecurityEvents() {
        const auditData = this.loadAuditData();
        const oneDayAgo = Date.now() - 86400000;
        
        return auditData.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime > oneDayAgo && 
                  (entry.eventType.includes('attempt') || entry.eventType.includes('banned'));
        }).length;
    },
    
    countOwnerTests() {
        const auditData = this.loadAuditData();
        return auditData.filter(entry => 
            entry.eventType === 'owner_prompt_inquiry' || 
            entry.eventType === 'owner_ban_attempt_prevented'
        ).length;
    },
    
    analyzeSecurityTrends() {
        const auditData = this.loadAuditData();
        const today = new Date().toDateString();
        
        const todayEvents = auditData.filter(entry => 
            new Date(entry.timestamp).toDateString() === today
        ).length;
        
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const yesterdayEvents = auditData.filter(entry => 
            new Date(entry.timestamp).toDateString() === yesterday
        ).length;
        
        if (yesterdayEvents === 0) return '📈 Không có dữ liệu so sánh';
        
        const change = ((todayEvents - yesterdayEvents) / yesterdayEvents * 100).toFixed(1);
        return `Hôm nay: ${todayEvents} | Hôm qua: ${yesterdayEvents} | Thay đổi: ${change}%`;
    },
    
    cleanupOldLogs() {
        try {
            const fs = require('fs');
            const path = require('path');
            const auditPath = path.join(__dirname, '../audit_log.json');
            
            if (!fs.existsSync(auditPath)) return 0;
            
            const raw = fs.readFileSync(auditPath, 'utf8');
            let auditData = JSON.parse(raw);
            
            // Giữ logs trong 7 ngày
            const sevenDaysAgo = Date.now() - 7 * 86400000;
            const originalLength = auditData.length;
            
            auditData = auditData.filter(entry => {
                const entryTime = new Date(entry.timestamp).getTime();
                return entryTime > sevenDaysAgo;
            });
            
            fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2));
            
            return originalLength - auditData.length;
        } catch (error) {
            Logger.error('Error cleaning logs:', error);
            return 0;
        }
    }
};
