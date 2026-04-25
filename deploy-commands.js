const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config();

const commands = [
    // Public Commands
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Check your or another user\'s message and voice stats')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check stats for')),
    
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top active users in the server'),

    // Admin Commands
    new SlashCommandBuilder()
        .setName('add-messages')
        .setDescription('Add messages to a user\'s count (Admin only)')
        .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Amount to add').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('remove-messages')
        .setDescription('Remove messages from a user\'s count (Admin only)')
        .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Amount to remove').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('reset-user')
        .setDescription('Reset a specific user\'s stats (Admin only)')
        .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('reset-all')
        .setDescription('Reset EVERYONE\'S message and voice stats (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Get Client ID from token (rough way) or use an env var
        // For simplicity, we'll ask the user to provide CLIENT_ID in .env
        const clientId = Buffer.from(process.env.DISCORD_TOKEN.split('.')[0], 'base64').toString();

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
