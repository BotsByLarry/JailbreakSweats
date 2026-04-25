const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const dotenv = require('dotenv');
const { getUser, updateUser } = require('./database');
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
    console.log(`Logged in as ${client.user.tag}`);
});

// --- Message Tracking ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    try {
        const userId = message.author.id;
        const user = await getUser(userId);
        
        user.messages = (user.messages || 0) + 1;
        await updateUser(userId, user);

        // Role Assignment
        const member = message.member;
        for (const roleData of messageRoles) {
            if (user.messages >= roleData.threshold && roleData.id) {
                const role = message.guild.roles.cache.get(roleData.id);
                if (role && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role).catch(console.error);
                    console.log(`Assigned role ${roleData.name} to ${message.author.tag}`);
                }
            }
        }
    } catch (error) {
        console.error('Error tracking message:', error);
    }
});

// --- Voice Tracking ---
client.on('voiceStateUpdate', async (oldState, newState) => {
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
                        const role = newState.guild.roles.cache.get(roleData.id);
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

client.login(process.env.DISCORD_TOKEN);
