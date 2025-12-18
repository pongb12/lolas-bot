const Logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    
    async execute(interaction) {
        try {
            // Xử lý Modal Submit
            if (interaction.isModalSubmit()) {
                Logger.info(`Modal submit nhận được: ${interaction.customId}`);
                
                // Kiểm tra nếu là feedback modal (customId bắt đầu bằng 'feedback_modal_')
                if (interaction.customId.startsWith('feedback_modal_')) {
                    const feedbackCommand = interaction.client.commands.get('feedbacks');
                    
                    if (!feedbackCommand) {
                        Logger.error('Không tìm thấy command feedbacks');
                        return interaction.reply({ 
                            content: '❌ Lỗi hệ thống: không tìm thấy handler!', 
                            ephemeral: true 
                        });
                    }
                    
                    if (!feedbackCommand.handleModalSubmit) {
                        Logger.error('Command feedbacks không có method handleModalSubmit');
                        return interaction.reply({ 
                            content: '❌ Lỗi hệ thống: handler không hợp lệ!', 
                            ephemeral: true 
                        });
                    }
                    
                    await feedbackCommand.handleModalSubmit(interaction);
                    return;
                }
            }

            // Xử lý Button Interaction
            if (interaction.isButton()) {
                Logger.info(`Button click: ${interaction.customId} bởi ${interaction.user.tag}`);
                // Button interactions được xử lý bởi collector trong command
                return;
            }

            // Xử lý Slash Commands (nếu có)
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                
                if (!command) {
                    Logger.warn(`Command không tồn tại: ${interaction.commandName}`);
                    return;
                }

                Logger.info(`Executing command: ${interaction.commandName} bởi ${interaction.user.tag}`);
                await command.execute(interaction);
            }

        } catch (error) {
            Logger.error('Lỗi trong interactionCreate:', error);
            Logger.error('Error stack:', error.stack);
            
            const errorMessage = '❌ Có lỗi xảy ra khi xử lý tương tác!';
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                Logger.error('Không thể gửi thông báo lỗi:', replyError);
            }
        }
    }
};
