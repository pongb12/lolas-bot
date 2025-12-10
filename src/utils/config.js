require('dotenv').config();

const config = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    PREFIX: process.env.PREFIX || '.',
    OWNER_ID: process.env.OWNER_ID || '',
    GUILD_ID: process.env.GUILD_ID || '',
    
    // Bot information
    BOT_NAME: 'Lol.AI',
    BOT_VERSION: '1.1.0',
    BOT_DESCRIPTION: 'AI assistant cho server Lol, dựa trên mô hình Gemini'
};

// Validate required environment variables
const required = ['DISCORD_TOKEN', 'GEMINI_API_KEY'];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`❌ Lỗi: Thiếu biến môi trường ${key}`);
        console.error(`Vui lòng tạo file .env từ .env.example và điền thông tin`);
        process.exit(1);
    }
}

console.log(`✅ Đã load config: ${config.BOT_NAME} v${config.BOT_VERSION}`);
console.log(`✅ Prefix: "${config.PREFIX}"`);

module.exports = config;
