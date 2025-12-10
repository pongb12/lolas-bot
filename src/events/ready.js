const config = require('../utils/config');
const Logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        Logger.success(`✅ ${config.BOT_NAME} đã sẵn sàng!`);
        Logger.success(`✅ Đăng nhập với tên: ${client.user.tag}`);
        Logger.success(`✅ ID: ${client.user.id}`);
        Logger.success(`✅ Phục vụ ${client.guilds.cache.size} server(s)`);
        Logger.success(`✅ Prefix: "${config.PREFIX}"`);
        
        // Set status
        const activities = [
            `${config.PREFIX}help để xem lệnh`,
            'chat với thành viên server Lol',
            'sử dụng Gemini',
            `phiên bản ${config.BOT_VERSION}`
        ];
        
        let i = 0;
        setInterval(() => {
            client.user.setActivity({
                name: activities[i++ % activities.length],
                type: 0 // PLAYING
            });
        }, 15000);
        
        // Log invite link
        Logger.info(`📎 Invite link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=277025508352`);
    }
};
