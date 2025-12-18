const Logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    
    async execute(interaction) {
        try {
            // QUAN TRỌNG: Xử lý Modal Submit trước tiên
            if (interaction.isModalSubmit()) {
                console.log('📝 Modal Submit detected:', interaction.customId);
                
                // NGAY LẬP TỨC defer để tránh timeout
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ ephemeral: true }).catch(err => {
                        console.error('Lỗi defer reply:', err);
                    });
                }
                
                // Kiểm tra nếu là feedback modal
                if (interaction.customId.startsWith('feedback_modal_')) {
                    console.log('🎯 Feedback modal detected');
                    
                    const feedbackCommand = interaction.client.commands.get('feedbacks');
                    
                    if (!feedbackCommand) {
                        console.error('❌ Không tìm thấy command feedbacks');
                        return await interaction.editReply({ 
                            content: '❌ Lỗi hệ thống: không tìm thấy handler!' 
                        });
                    }
                    
                    if (typeof feedbackCommand.handleModalSubmit !== 'function') {
                        console.error('❌ handleModalSubmit không phải là function');
                        return await interaction.editReply({ 
                            content: '❌ Lỗi hệ thống: handler không hợp lệ!' 
                        });
                    }
                    
                    console.log('✅ Calling handleModalSubmit...');
                    await feedbackCommand.handleModalSubmit(interaction);
                    return;
                }
                
                // Modal khác không được xử lý
                console.log('⚠️ Unknown modal:', interaction.customId);
                return;
            }

            // Xử lý Button Interaction
            if (interaction.isButton()) {
                console.log(`🔘 Button click: ${interaction.customId}`);
                // Button được xử lý bởi collector
                return;
            }

            // Xử lý Slash Commands
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                
                if (!command) {
                    console.warn(`⚠️ Command không tồn tại: ${interaction.commandName}`);
                    return;
                }

                console.log(`⚡ Executing command: ${interaction.commandName}`);
                await command.execute(interaction);
            }

        } catch (error) {
            console.error('❌ Lỗi trong interactionCreate:', error);
            console.error('Stack:', error.stack);
            
            const errorMessage = '❌ Có lỗi xảy ra khi xử lý tương tác!';
            
            try {
                if (interaction.replied) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else if (interaction.deferred) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                console.error('❌ Không thể gửi thông báo lỗi:', replyError);
            }
        }
    }
};
