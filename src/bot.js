const config = require('./utils/config');

// Nếu là development, load config từ file local
if (config.isDevelopment()) {
    try {
        const devConfig = require('../config.development.js');
        console.log('⚠️  Đang chạy ở chế độ DEVELOPMENT với config local');
    } catch (error) {
        console.warn('⚠️  Không tìm thấy config.development.js');
        console.warn('Tạo file config.development.js từ config.example.js để chạy local');
    }
}
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./utils/config');
const Logger = require('./utils/logger');

// Khởi tạo client với các intents cần thiết
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageTyping,
    ]
});

// Collection cho commands
client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        Logger.success(`Đã load command: ${command.name}`);
    } else {
        Logger.warn(`Command ${filePath} thiếu thuộc tính "name" hoặc "execute"`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
    Logger.success(`Đã load event: ${event.name}`);
}

// Xử lý message commands
client.on('messageCreate', async message => {
    // Bỏ qua nếu là bot hoặc không có prefix
    if (message.author.bot || !message.content.startsWith(config.PREFIX)) return;
    
    // Parse arguments
    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Tìm command
    const command = client.commands.get(commandName) ||
                   Array.from(client.commands.values()).find(cmd => 
                       cmd.aliases && cmd.aliases.includes(commandName));
    
    if (!command) return;
    
    // Cooldown system
    if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`⏰ Vui lòng chờ ${timeLeft.toFixed(1)} giây trước khi dùng lại lệnh \`${config.PREFIX}${command.name}\``);
        }
    }
    
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    
    // Thực thi command
    try {
        Logger.info(`[Command] ${command.name} executed by ${message.author.tag} (${message.author.id})`);
        await command.execute(message, args);
    } catch (error) {
        Logger.error(`[Command Error] ${command.name}:`, error);
        
        const errorEmbed = {
            color: 0xff0000,
            title: '❌ Lỗi khi thực thi lệnh',
            description: 'Đã xảy ra lỗi khi thực thi lệnh này.',
            fields: [
                {
                    name: 'Lệnh',
                    value: `\`${config.PREFIX}${command.name}\``,
                    inline: true
                },
                {
                    name: 'Lỗi',
                    value: `\`${error.message}\``,
                    inline: true
                }
            ],
            footer: {
                text: 'Vui lòng báo cho admin nếu lỗi tiếp tục xảy ra'
            }
        };
        
        await message.reply({ embeds: [errorEmbed] });
    }
});

// Xử lý lỗi
client.on('error', error => {
    Logger.error('[Discord Client Error]:', error);
});

process.on('unhandledRejection', error => {
    Logger.error('[Unhandled Promise Rejection]:', error);
});

process.on('SIGINT', () => {
    Logger.info('🛑 Đang tắt bot...');
    client.destroy();
    process.exit(0);
});

// Đăng nhập
Logger.info('🚀 Đang khởi động Lol.AI...');
client.login(config.DISCORD_TOKEN).catch(error => {
    Logger.error('❌ Lỗi đăng nhập Discord:', error.message);
    process.exit(1);
});

module.exports = client;
