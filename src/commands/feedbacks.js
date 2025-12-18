const Logger = require('../utils/logger');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    name: 'feedbacks',
    description: '📢 Gửi phản hồi cho tác giả',
    usage: '.feedbacks',

    async execute(message, args) {
        try {
            // Tạo modal (form popup)
            const modal = new ModalBuilder()
                .setCustomId('feedback_modal')
                .setTitle('📢 Gửi phản hồi cho tác giả');

            // Tạo input cho tiêu đề
            const titleInput = new TextInputBuilder()
                .setCustomId('feedback_title')
                .setLabel('Tiêu đề phản hồi')
                .setPlaceholder('Ví dụ: Đề xuất tính năng mới')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);

            // Tạo input cho nội dung
            const contentInput = new TextInputBuilder()
                .setCustomId('feedback_content')
                .setLabel('Nội dung phản hồi')
                .setPlaceholder('Mô tả chi tiết phản hồi của bạn...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(1000);

            // Thêm inputs vào action rows
            const titleRow = new ActionRowBuilder().addComponents(titleInput);
            const contentRow = new ActionRowBuilder().addComponents(contentInput);

            modal.addComponents(titleRow, contentRow);

            // Kiểm tra xem message có phải từ interaction không
            // Nếu là message thường, tạo một button để mở modal
            const buttonEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📢 Hệ thống phản hồi')
                .setDescription('Nhấn vào nút bên dưới để gửi phản hồi cho tác giả!')
                .setFooter({ text: 'Lol.AI Feedback System' });

            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new (require('discord.js').ButtonBuilder)()
                        .setCustomId('open_feedback_modal')
                        .setLabel('📝 Gửi phản hồi')
                        .setStyle(require('discord.js').ButtonStyle.Primary)
                );

            const reply = await message.reply({ 
                embeds: [buttonEmbed], 
                components: [buttonRow],
                fetchReply: true 
            });

            // Lắng nghe button click
            const collector = reply.createMessageComponentCollector({ 
                time: 300000 // 5 phút
            });

            collector.on('collect', async interaction => {
                if (interaction.customId === 'open_feedback_modal') {
                    await interaction.showModal(modal);
                }
            });

            collector.on('end', () => {
                reply.edit({ components: [] }).catch(() => {});
            });

        } catch (error) {
            Logger.error('Lỗi khi tạo feedback modal:', error);
            return message.reply('❌ Có lỗi xảy ra khi tạo form phản hồi. Vui lòng thử lại sau!');
        }
    },

    // Handler cho modal submit
    async handleModalSubmit(interaction) {
        const ownerId = '1003323955693764748';

        try {
            // Lấy dữ liệu từ modal
            const title = interaction.fields.getTextInputValue('feedback_title');
            const content = interaction.fields.getTextInputValue('feedback_content');
            
            const userId = interaction.user.id;
            const userTag = interaction.user.tag;
            const channelName = interaction.channel?.name || 'Direct Message';
            const guildName = interaction.guild?.name || 'Direct Message';

            // Reply ngay để tránh timeout (3 giây)
            await interaction.deferReply({ ephemeral: true });

            // Tìm user tác giả
            const owner = await interaction.client.users.fetch(ownerId);

            if (!owner) {
                Logger.error(`Không tìm thấy user với ID: ${ownerId}`);
                return interaction.editReply({
                    content: '❌ Không thể gửi phản hồi lúc này. Vui lòng thử lại sau!',
                });
            }

            // Tạo embed phản hồi gửi cho tác giả
            const feedbackEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📢 Phản hồi mới từ người dùng')
                .addFields(
                    { name: '📌 Tiêu đề', value: title },
                    { name: '👤 Người gửi', value: `${userTag} (ID: ${userId})` },
                    { name: '🏠 Server', value: guildName },
                    { name: '📁 Kênh', value: channelName },
                    { name: '📝 Nội dung', value: content }
                )
                .setTimestamp()
                .setFooter({ text: 'Lol.AI Feedback System' });

            // Gửi DM cho tác giả
            await owner.send({ embeds: [feedbackEmbed] });

            // Thông báo thành công (chỉ người gửi thấy)
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Đã gửi phản hồi thành công!')
                .setDescription('Cảm ơn bạn đã gửi phản hồi! Tác giả sẽ xem xét và cải thiện bot.')
                .addFields(
                    { name: '📌 Tiêu đề', value: title },
                    { name: '📝 Nội dung', value: content.substring(0, 500) + (content.length > 500 ? '...' : '') }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            Logger.info(`📢 Feedback từ ${userTag}: [${title}] ${content.substring(0, 50)}...`);

        } catch (error) {
            Logger.error('Lỗi khi gửi feedback:', error);

            // Thông báo lỗi (chỉ người gửi thấy)
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Gửi phản hồi thất bại')
                .setDescription('Đã xảy ra lỗi khi gửi phản hồi. Vui lòng thử lại sau!')
                .addFields(
                    { name: '⚠️ Lỗi', value: error.message || 'Không xác định' }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });

            // Fallback: Gửi vào kênh log nếu có
            const logChannel = interaction.client.channels.cache.find(
                ch => ch.name === 'bot-logs' || ch.name === 'log'
            );
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('📢 Feedback (Gửi thất bại)')
                    .addFields(
                        { name: '👤 Người gửi', value: interaction.user.tag },
                        { name: '📝 Nội dung', value: interaction.fields.getTextInputValue('feedback_content') },
                        { name: '⚠️ Lỗi', value: error.message }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }
    }
};
