// events/messageCreate.js
const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const Config = require('../utils/config');
const Logger = require('../utils/logger');
const ai = require('../ai');

module.exports = {
  name: Events.MessageCreate,

  /**
   * @param {import('discord.js').Message} message
   */
  async execute(message) {
    try {
      // Bỏ qua message từ bot
      if (message.author.bot) return;

      // Lấy privateManager từ client (nếu đã đính kèm ở bot.js)
      const privateManager = message.client.privateManager;

      if (privateManager) {
        const userChannel = privateManager.getPrivateChannel(message.author.id);
        // Nếu user nhắn đúng vào kênh private của họ -> reset timer
        if (userChannel && userChannel.channelId === message.channel.id) {
          privateManager.updateActivity(message.author.id);
        }
      }

      // Nếu là DM (Direct Message) -> xử lý private message
      // ChannelType.DM là enum (value = 1)
      if (message.channel.type === ChannelType.DM || message.channel.isDMBased) {
        // Nếu botInstance có method chuyên xử lý private -> dùng nó (giữ logic tập trung)
        const botInstance = message.client.botInstance;
        if (botInstance && typeof botInstance.handlePrivateMessage === 'function') {
          await botInstance.handlePrivateMessage(message);
          return;
        }

        // Nếu không có botInstance thì fallback: gọi ai.askPrivate rồi trả lời
        try {
          message.channel.sendTyping().catch(() => {});
          const reply = await ai.askPrivate(message.author.id, message.content);
          await message.channel.send({ content: reply }).catch(() => {});
        } catch (err) {
          Logger.error('Lỗi xử lý DM fallback:', err);
          await message.channel.send('❌ Đã xảy ra lỗi khi xử lý tin nhắn.').catch(() => {});
        }
        return;
      }

      // Không phải DM: xử lý command (nếu bắt đầu bằng prefix)
      if (!message.content.startsWith(Config.PREFIX)) return;

      // Nếu bot instance có handleCommand (tích hợp rate limit, cooldown, v.v.) -> gọi
      const botInstance = message.client.botInstance;
      if (botInstance && typeof botInstance.handleCommand === 'function') {
        await botInstance.handleCommand(message);
        return;
      }

      // Fallback: xử lý command cục bộ (nếu bạn không dùng botInstance.handleCommand)
      const args = message.content.slice(Config.PREFIX.length).trim().split(/ +/g);
      const commandName = args.shift().toLowerCase();

      const command = message.client.commands?.get(commandName);
      if (!command) return;

      try {
        await command.execute(message, args, {
          bot: message.client.botInstance || null,
          privateManager
        });
      } catch (err) {
        Logger.error(`Lỗi khi thực thi command ${commandName}:`, err);
        await message.reply('❌ Có lỗi khi thực thi lệnh.').catch(() => {});
      }

    } catch (error) {
      Logger.error('Lỗi trong messageCreate handler:', error);
    }
  }
};


// --- Interaction handler (button appeal) ---
// Xuất phần xử lý interaction cùng file để tiện import nơi đăng ký events
module.exports.interactionHandler = async (interaction) => {
  if (!interaction.isButton()) return;

  // Kiểm tra xem có phải button appeal không
  if (
    interaction.customId.startsWith('approve_appeal_') ||
    interaction.customId.startsWith('deny_appeal_') ||
    interaction.customId.startsWith('ignore_appeal_')
  ) {
    // Chỉ owner mới được xử lý
    if (!Config.OWNER_ID || interaction.user.id !== Config.OWNER_ID) {
      return interaction.reply({
        content: '❌ Chỉ Admin mới có quyền xử lý kháng cáo!',
        ephemeral: true
      });
    }

    const parts = interaction.customId.split('_'); // e.g. ['approve','appeal','<userId>']
    const action = parts[0]; // approve | deny | ignore
    const userId = parts[2];

    try {
      const user = await interaction.client.users.fetch(userId).catch(() => null);

      if (action === 'approve') {
        // Gỡ chặn user
        ai.unblockUser(userId);

        const newEmbed = EmbedBuilder.from(interaction.message.embeds[0] ?? new EmbedBuilder())
          .setColor(0x00FF00)
          .setTitle('✅ KHÁNG CÁO ĐƯỢC CHẤP NHẬN')
          .addFields(
            { name: '👑 Xử lý bởi', value: 'Chủ bot' },
            { name: '✅ Kết quả', value: 'ĐÃ GỠ CHẶN' }
          );

        await interaction.message.edit({ embeds: [newEmbed], components: [] }).catch(() => {});
        await interaction.reply({ content: `✅ Đã chấp nhận kháng cáo và gỡ chặn user ${user ? user.tag : userId}`, ephemeral: true });

        if (user) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Kháng cáo của bạn đã được chấp nhận')
            .setDescription('Tài khoản của bạn đã được gỡ chặn!')
            .addFields(
              { name: '👑 Bởi', value: 'Owner' },
              { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
              { name: '💡 Lưu ý', value: 'Vui lòng tuân thủ quy tắc sử dụng bot để tránh bị chặn lại.' }
            )
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        Logger.warn(`APPEAL: Chủ bot đã chấp nhận kháng cáo của ${user ? user.tag : userId}`);

      } else if (action === 'deny') {
        const newEmbed = EmbedBuilder.from(interaction.message.embeds[0] ?? new EmbedBuilder())
          .setColor(0xFF0000)
          .setTitle('❌ KHÁNG CÁO BỊ TỪ CHỐI')
          .addFields(
            { name: '👑 Xử lý bởi', value: 'Owner' },
            { name: '❌ Kết quả', value: 'KHÔNG GỠ CHẶN' }
          );

        await interaction.message.edit({ embeds: [newEmbed], components: [] }).catch(() => {});
        await interaction.reply({ content: `❌ Đã từ chối kháng cáo của user ${user ? user.tag : userId}`, ephemeral: true });

        if (user) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Kháng cáo của bạn đã bị từ chối')
            .setDescription('Tài khoản của bạn vẫn bị chặn.')
            .addFields(
              { name: '👑 Bởi', value: 'Owner' },
              { name: '🕒 Thời gian', value: new Date().toLocaleString('vi-VN') },
              { name: '⏳ Thời hạn chặn', value: 'Bạn có thể thử lại sau 1 giờ.' },
              { name: '📞 Liên hệ', value: `Nếu cần giải thích, liên hệ: <@${Config.OWNER_ID}>` }
            )
            .setTimestamp();

          await user.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        Logger.warn(`APPEAL: Admin đã từ chối kháng cáo của ${user ? user.tag : userId}`);

      } else if (action === 'ignore') {
        const newEmbed = EmbedBuilder.from(interaction.message.embeds[0] ?? new EmbedBuilder())
          .setColor(0xFFA500)
          .setTitle('⏳ KHÁNG CÁO ĐỢI XỬ LÝ')
          .addFields(
            { name: '👑 Đánh dấu bởi', value: 'Owner' },
            { name: '⏳ Trạng thái', value: 'ĐỢI XEM SAU' }
          );

        await interaction.message.edit({ embeds: [newEmbed], components: [] }).catch(() => {});
        await interaction.reply({ content: `⏳ Đã đánh dấu kháng cáo của ${user ? user.tag : userId} là "xem sau"`, ephemeral: true });

        Logger.warn(`APPEAL: Chủ bot đã đánh dấu kháng cáo của ${user ? user.tag : userId} là "xem sau"`);
      }

    } catch (error) {
      Logger.error('Lỗi khi xử lý button appeal:', error);
      await interaction.reply({ content: '❌ Đã có lỗi xảy ra khi xử lý kháng cáo!', ephemeral: true }).catch(() => {});
    }
  }
};
