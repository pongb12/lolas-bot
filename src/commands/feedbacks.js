const Logger = require('../utils/logger');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'feedbacks',
    description: '📢 Gửi phản hồi cho tác giả',
    usage: '.feedbacks',

    async execute(message, args) {
        try {
            // Tạo embed hướng dẫn
            const buttonEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📢 Hệ thống phản hồi')
                .setDescription('Nhấn vào nút bên dưới để gửi phản hồi cho tác giả!')
                .setFooter({ text: 'Lol.AI Feedback System' })
                .setTimestamp();

            // Tạo button
            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`open_feedback_${message.author.id}`)
                        .setLabel('📝 Gửi phản hồi')
                        .setStyle(ButtonStyle.Primary)
                );

            const reply = await message.reply({ 
                embeds: [buttonEmbed], 
                components: [buttonRow]
            });

            // Tạo collector để lắng nghe button click
            const collector = reply.createMessageComponentCollector({ 
                filter: i => i.user.id === message.author.id,
                time: 300000 // 5 phút
            });

            collector.on('collect', async interaction => {
                try {
                    // Tạo modal
                    const modal = new ModalBuilder()
                        .setCustomId(`feedback_modal_${interaction.user.id}_${Date.now()}`)
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

                    // Hiển thị modal
                    await interaction.showModal(modal);

                } catch (error) {
                    Logger.error('Lỗi khi hiển thị modal:', error);
                    await interaction.reply({ 
                        content: '❌ Có lỗi xảy ra khi mở form. Vui lòng thử lại!', 
                        ephemeral: true 
                    }).catch(() => {});
                }
            });

            collector.on('end', () => {
                // Xóa button sau khi hết thời gian
                reply.edit({ components: [] }).catch(() => {});
            });

        } catch (error) {
            Logger.error('Lỗi khi tạo feedback button:', error);
            return message.reply('❌ Có lỗi xảy ra khi tạo hệ thống phản hồi. Vui lòng thử lại sau!');
        }
    },

    // Handler cho modal submit
    async handleModalSubmit(interaction) {
        const ownerId = '1003323955693764748';

        try {
            // Defer reply ngay để tránh timeout
            await interaction.deferReply({ ephemeral: true });

            // Lấy dữ liệu từ modal
            const title = interaction.fields.getTextInputValue('feedback_title');
            const content = interaction.fields.getTextInputValue('feedback_content');
            
            const userId = interaction.user.id;
            const userTag = interaction.user.tag;
            const userName = interaction.user.username;
            const channelName = interaction.channel?.name || 'Direct Message';
            const guildName = interaction.guild?.name || 'Direct Message';

            Logger.info(`Đang xử lý feedback từ ${userTag}...`);

            // Tìm user tác giả
            let owner;
            try {
                owner = await interaction.client.users.fetch(ownerId);
            } catch (fetchError) {
                Logger.error(`Không thể fetch user ${ownerId}:`, fetchError);
                throw new Error('Không thể kết nối đến tác giả');
            }

            if (!owner) {
                throw new Error('Không tìm thấy tác giả');
            }

            // Tạo embed phản hồi gửi cho tác giả
            const feedbackEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📢 Phản hồi mới từ người dùng')
                .addFields(
                    { name: '📌 Tiêu đề', value: title },
                    { name: '👤 Người gửi', value: `${userName} (@${userTag})\nID: ${userId}`, inline: true },
                    { name: '🏠 Server', value: guildName, inline: true },
                    { name: '📁 Kênh', value: channelName, inline: true },
                    { name: '📝 Nội dung', value: content }
                )
                .setTimestamp()
                .setFooter({ text: 'Lol.AI Feedback System' });

            // Gửi DM cho tác giả
            try {
                await owner.send({ embeds: [feedbackEmbed] });
            } catch (dmError) {
                Logger.error('Không thể gửi DM cho owner:', dmError);
                
                // Thử gửi vào kênh log thay thế
                const logChannel = interaction.client.channels.cache.find(
                    ch => ch.name === 'bot-logs' || ch.name === 'log'
                );
                
                if (logChannel) {
                    await logChannel.send({ embeds: [feedbackEmbed] });
                } else {
                    throw new Error('Không thể gửi tin nhắn đến tác giả (DM bị khóa)');
                }
            }

            // Thông báo thành công (chỉ người gửi thấy)
            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Đã gửi phản hồi thành công!')
                .setDescription('Cảm ơn bạn đã gửi phản hồi! Tác giả sẽ xem xét và cải thiện bot.')
                .addFields(
                    { name: '📌 Tiêu đề', value: title },
                    { name: '📝 Nội dung', value: content.length > 500 ? content.substring(0, 500) + '...' : content }
                )
                .setTimestamp()
                .setFooter({ text: 'Phản hồi của bạn đã được ghi nhận' });

            await interaction.editReply({ embeds: [successEmbed] });

            Logger.info(`📢 Feedback từ ${userTag}: [${title}] ${content.substring(0, 50)}...`);

        } catch (error) {
            Logger.error('Lỗi khi xử lý feedback modal:', error);
            Logger.error('Error stack:', error.stack);

            // Thông báo lỗi (chỉ người gửi thấy)
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Gửi phản hồi thất bại')
                .setDescription('Đã xảy ra lỗi khi gửi phản hồi. Vui lòng thử lại sau hoặc liên hệ trực tiếp với tác giả.')
                .addFields(
                    { name: '⚠️ Chi tiết lỗi', value: `\`\`\`${error.message || 'Không xác định'}\`\`\`` }
                )
                .setTimestamp();

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                Logger.error('Không thể gửi thông báo lỗi:', replyError);
            }
        }
    }
};
