// deploy-commands.js

const { REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Add a SteamID to the watchlist')
        .addStringOption(option =>
            option.setName('steam_id')
                .setDescription('The SteamID64 of the player')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a SteamID from the watchlist')
        .addStringOption(option =>
            option.setName('steam_id')
                .setDescription('The SteamID64 of the player')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('list')
        .setDescription('Lists all SteamIDs currently on the watchlist'),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check the current online/offline status of a player')
        .addStringOption(option =>
            option.setName('steam_id')
                .setDescription('The SteamID64 of the player')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('force_check')
        .setDescription('Force check all monitored players for online status'),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        console.log(`Deploying commands for application ID: ${process.env.DISCORD_CLIENT_ID}`);

        // Deploy commands globally (available in all servers)
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands },
        );

        // Also deploy to specific guild for faster access (if GUILD_ID is set)
        if (process.env.GUILD_ID) {
            console.log(`Also deploying to guild: ${process.env.GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log('Successfully deployed guild-specific commands.');
        }

        console.log('Successfully reloaded application (/) commands.');
        console.log(`Deployed ${commands.length} commands globally.`);
    } catch (error) {
        console.error('Error deploying commands:', error);
        if (error.status === 401) {
            console.error('❌ Invalid bot token. Check your BOT_TOKEN in .env file.');
        } else if (error.status === 403) {
            console.error('❌ Bot lacks permission to register commands.');
        } else if (error.status === 404) {
            console.error('❌ Invalid application ID. Check your DISCORD_CLIENT_ID in .env file.');
        }
    }
})();