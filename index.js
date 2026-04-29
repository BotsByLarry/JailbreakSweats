const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const { getUser, updateUser, getTopUsers, resetAllUsers } = require('./database');
const { messageRoles, voiceRoles } = require('./roles');

dotenv.config();

// --- Express Server for Uptime Monitoring ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is online!');
});

app.listen(port, () => {
    console.log(`Uptime server running on port ${port}`);
});

// --- Discord Bot ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🤖 Bot is ready in ${client.guilds.cache.size} servers.`);
    
    // Start Heartbeat System
    startHeartbeat();
});

// --- Heartbeat System (Self-Ping & Health Monitoring) ---
function startHeartbeat() {
    const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    setInterval(async () => {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const latency = client.ws.ping;

        console.log(`[Heartbeat] 💓 Status: ONLINE | Latency: ${latency}ms | Memory: ${memoryUsage}MB | Uptime: ${days}d ${hours}h ${minutes}m`);

        // Self-Ping to keep the server awake
        const projectUrl = process.env.PROJECT_URL || `http://localhost:${port}`;
        http.get(projectUrl, (res) => {
            // console.log(`[Heartbeat] Self-ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error(`[Heartbeat] Self-ping failed: ${err.message}`);
        });
    }, PING_INTERVAL);
}

// --- Global Error Handling ---
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// Helper function to check and assign roles
async function checkRoles(member, messages, voiceMinutes) {
    const voiceHours = voiceMinutes / 60;
    let rolesAdded = [];
    const milestoneChannelId = process.env.MILESTONE_CHANNEL_ID;
    let channel = null;
    if (milestoneChannelId) {
        channel = member.guild.channels.cache.get(milestoneChannelId) || await member.guild.channels.fetch(milestoneChannelId).catch(() => null);
    }

    // Message Roles
    for (const roleData of messageRoles) {
        if (messages >= roleData.threshold && roleData.id) {
            const role = member.guild.roles.cache.get(roleData.id) || await member.guild.roles.fetch(roleData.id).catch(() => null);
            if (role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(console.error);
                rolesAdded.push(roleData.name);

                // Send milestone message
                if (channel) {
                    await channel.send(`<@${member.id}> has received the **${roleData.name}** role for reaching **${roleData.threshold}** messages! 🥳`).catch(console.error);
                }
            }
        }
    }

    // Voice Roles
    for (const roleData of voiceRoles) {
        if (voiceHours >= roleData.threshold && roleData.id) {
            const role = member.guild.roles.cache.get(roleData.id) || await member.guild.roles.fetch(roleData.id).catch(() => null);
            if (role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(console.error);
                rolesAdded.push(roleData.name);

                // Send milestone message
                if (channel) {
                    await channel.send(`<@${member.id}> has received the **${roleData.name}** role for spending **${roleData.threshold}** hours in voice! 🎙️`).catch(console.error);
                }
            }
        }
    }
    return rolesAdded;
}

// --- Message Tracking ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // DEBUG: Log message info
    console.log(`Message from ${message.author.tag} in ${message.channel.id}: "${message.content}"`);

    // --- WFL Feature ---
    const wflChannelId = process.env.WFL_CHANNEL_ID;
    const allowedChannelId = process.env.ALLOWED_CHANNEL_ID;
    
    if (wflChannelId && message.channel.id === wflChannelId) {
        console.log(`Checking WFL in correct channel. Content: "${message.content}"`);
        if (message.content.toLowerCase().includes('wfl')) {
            console.log('WFL detected! Reacting...');
            try {
                await message.react('1496687020356014180'); // Win
                await message.react('1496686972130037780'); // Fair
                await message.react('1496686848146276392'); // Lose
                console.log('Reactions added successfully.');
            } catch (error) {
                console.error('Error adding reactions:', error);
            }
        }
    }

    // --- Message Tracking ---
    if (allowedChannelId && message.channel.id !== allowedChannelId) {
        // console.log(`Skipping tracking: channel ${message.channel.id} is not ${allowedChannelId}`);
        return;
    }

    try {
        const userId = message.author.id;
        const user = await getUser(userId);
        
        user.messages = (user.messages || 0) + 1;
        await updateUser(userId, user);

        // Check Roles
        await checkRoles(message.member, user.messages, user.voiceMinutes || 0);
    } catch (error) {
        console.error('Error tracking message:', error);
    }
});

// --- Voice Tracking ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    return; // Voice tracking temporarily disabled
    
    const userId = newState.id;
    if (newState.member.user.bot) return;

    try {
        const user = await getUser(userId);

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            user.lastVoiceJoin = Date.now();
            await updateUser(userId, user);
        }
        
        // User left a voice channel
        if (oldState.channelId && !newState.channelId) {
            if (user.lastVoiceJoin) {
                const durationMinutes = Math.floor((Date.now() - user.lastVoiceJoin) / 60000);
                user.voiceMinutes = (user.voiceMinutes || 0) + durationMinutes;
                user.lastVoiceJoin = null;
                await updateUser(userId, user);

                // Role Assignment (Voice)
                const member = newState.member;
                const hours = user.voiceMinutes / 60;
                for (const roleData of voiceRoles) {
                    if (hours >= roleData.threshold && roleData.id) {
                        const role = newState.guild.roles.cache.get(roleData.id) || await newState.guild.roles.fetch(roleData.id).catch(() => null);
                        if (role && !member.roles.cache.has(role.id)) {
                            await member.roles.add(role).catch(console.error);
                            console.log(`Assigned voice role ${roleData.name} to ${member.user.tag}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error tracking voice:', error);
    }
});

// --- Slash Commands ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const startTime = Date.now();
    const { commandName, options, channelId, member } = interaction;

    console.log(`[Interaction] Received /${commandName} from ${interaction.user.tag}`);

    try {
        // Channel restriction for commands (Admins bypass)
        const allowedChannelId = process.env.ALLOWED_CHANNEL_ID;
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (allowedChannelId && channelId !== allowedChannelId && !isAdmin) {
            return interaction.reply({
                content: `❌ This bot can only be used in <#${allowedChannelId}>!`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Add a small delay check to warn if we're hitting the 3s limit
        const timeoutWarn = setTimeout(() => {
            console.warn(`⚠️ Warning: /${commandName} is taking more than 2.5s to respond!`);
        }, 2500);

        if (commandName === 'grind-status') {
            await interaction.deferReply();
            const targetUser = options.getUser('user') || interaction.user;
            const userStats = await getUser(targetUser.id);
            const voiceHours = (userStats.voiceMinutes / 60 || 0).toFixed(1);

            await interaction.editReply({
                content: `📊 **Sweat Stats for ${targetUser.tag}**\n- Messages: \`${userStats.messages || 0}\`\n- Voice Time: \`${voiceHours} hours\``
            });
        }

        else if (commandName === 'top-grinders') {
            await interaction.deferReply();
            const topUsers = await getTopUsers(10);
            
            if (topUsers.length === 0) {
                return interaction.editReply('No grinders found in the database yet!');
            }

            let lbMessage = '🏆 **Hall of Fame (Top 10)**\n\n';
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                lbMessage += `${i + 1}. <@${user.id}> - \`${user.messages}\` messages\n`;
            }

            await interaction.editReply(lbMessage);
        }

        // Admin Commands
        else if (commandName === 'boost-count') {
            await interaction.deferReply();
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            const userStats = await getUser(targetUser.id);

            userStats.messages = (userStats.messages || 0) + amount;
            await updateUser(targetUser.id, userStats);

            const memberObj = await interaction.guild.members.fetch(targetUser.id);
            const rolesGiven = await checkRoles(memberObj, userStats.messages, userStats.voiceMinutes || 0);

            let response = `🚀 Boosted ${targetUser.tag} by \`${amount}\` messages! New total: \`${userStats.messages}\``;
            if (rolesGiven.length > 0) {
                response += `\n✨ **New Roles Assigned:** ${rolesGiven.join(', ')}`;
            }

            await interaction.editReply(response);
        }

        else if (commandName === 'slash-count') {
            await interaction.deferReply();
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            const userStats = await getUser(targetUser.id);

            userStats.messages = Math.max(0, (userStats.messages || 0) - amount);
            await updateUser(targetUser.id, userStats);

            await interaction.editReply(`🔪 Slashed \`${amount}\` messages from ${targetUser.tag}. New total: \`${userStats.messages}\``);
        }

        else if (commandName === 'clear-history') {
            await interaction.deferReply();
            const targetUser = options.getUser('user');
            await updateUser(targetUser.id, { messages: 0, voiceMinutes: 0 });
            await interaction.editReply(`🧹 History cleared for ${targetUser.tag}.`);
        }

        else if (commandName === 'season-reset') {
            await interaction.deferReply();
            await resetAllUsers();
            await interaction.editReply('🌊 **SEASON RESET!** All grind stats have been wiped!');
        }

        clearTimeout(timeoutWarn);
        const duration = Date.now() - startTime;
        console.log(`[Interaction] Finished /${commandName} in ${duration}ms`);

    } catch (error) {
        console.error(`❌ Error handling /${commandName}:`, error);
        
        // Try to let the user know something went wrong
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ An error occurred while executing this command. Check the logs.' });
            } else {
                await interaction.reply({ content: '❌ An error occurred while executing this command. Check the logs.', ephemeral: true });
            }
        } catch (innerError) {
            console.error('Failed to send error message to Discord:', innerError.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
