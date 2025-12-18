const Logger = require('../utils/logger');

module.exports = {
    name: 'interactionCreate',
    
    async execute(interaction) {
        try {
            // Xử lý Modal Submit
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'feedback_modal') {
                    const feedbackCommand = interaction.client.commands.get('feedbacks');
                    if (feedbackCommand && feedbackCommand.handleModalSubmit) {
                        await feedbackCommand.handleModalSubmit(interaction);
                    }
                }
                return;
            }

            // Xử lý Button Interaction
            if (interaction.isButton()) {
                // Button interactions được xử lý bởi collector trong command
                return;
            }

            // Xử lý Slash Commands (nếu có)
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                await command.execute(interaction);
            }

        } catch (error) {
            Logger.error('Lỗi trong interactionCreate:', error);
            
            const errorMessage = '❌ Có lỗi xảy ra khi xử lý tương tác!';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
            }
        }
    }
};
