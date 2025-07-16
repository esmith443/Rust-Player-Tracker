// index.js

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const { BOT_TOKEN, WEBHOOK_PLAYER_ALERT, WEBHOOK_LOGGING, BATTLEMETRICS_TOKEN, CHECK_INTERVAL } = process.env;
const WATCHLIST_FILE = path.join(__dirname, 'watchlist.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let watchlist = new Map();

const loadWatchlist = async () => {
    try {
        await fs.access(WATCHLIST_FILE);
        const data = await fs.readFile(WATCHLIST_FILE, 'utf-8');
        if (!data.trim()) {
            console.warn('⚠️ watchlist.json was empty. Initializing with empty watchlist.');
            watchlist = new Map();
            await saveWatchlist();
            return;
        }
        const json = JSON.parse(data);
        watchlist = new Map(Object.entries(json));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn('⚠️ watchlist.json not found. Creating a new one.');
            await saveWatchlist();
        } else {
            console.error('❌ Failed to load watchlist:', error);
        }
    }
};

const saveWatchlist = async () => {
    try {
        const obj = Object.fromEntries(watchlist);
        await fs.writeFile(WATCHLIST_FILE, JSON.stringify(obj, null, 4));
    } catch (error) {
        console.error('Failed to save watchlist:', error);
    }
};

const bmAxios = axios.create({
    baseURL: 'https://api.battlemetrics.com',
    headers: {
        'Authorization': `Bearer ${BATTLEMETRICS_TOKEN}`
    }
});

const getServerName = async (serverId) => {
    try {
        const response = await bmAxios.get(`/servers/${serverId}`);
        return response.data.data.attributes.name;
    } catch (error) {
        console.error(`Error fetching server name for ${serverId}:`, error);
        return 'Unknown Server';
    }
};

const getPlayerName = async (steamId) => {
    try {
        // Check if we already have the name cached
        const cachedInfo = watchlist.get(steamId);
        if (cachedInfo?.playerName) {
            return cachedInfo.playerName;
        }
        
        // First resolve Steam ID to BM Player ID using private API
        const searchRes = await bmAxios.get(`/players?filter[search]=${steamId}`);
        const player = searchRes.data.data?.[0];
        if (!player) return 'Unknown';
        
        const bmPlayerId = player.id;
        
        // Then get player name from public API
        const publicRes = await axios.get(`https://api.battlemetrics.com/players/${bmPlayerId}`);
        const publicPlayer = publicRes.data.data;
        return publicPlayer.attributes?.name || 'Unknown';
    } catch (error) {
        console.error(`Error fetching player name for ${steamId}:`, error);
        return 'Unknown';
    }
};

const sendPlayerOnlineEmbed = async (steamId, serverName, playerName = null) => {
    const embed = new EmbedBuilder()
        .setTitle('🎮 Player Online')
        .setColor('#2E8B57')
        .addFields(
            { name: 'Player', value: playerName || 'Unknown' },
            { name: 'SteamID', value: `\`${steamId}\`` },
            { name: 'Server', value: serverName },
            { name: 'BattleMetrics', value: `https://www.battlemetrics.com/rcon/players?filter[search]=${steamId}` }
        )
        .setTimestamp();

    try {
        await axios.post(WEBHOOK_PLAYER_ALERT, { embeds: [embed] });
    } catch (error) {
        console.error('Failed to send player online alert webhook:', error);
    }
};

const sendPlayerOfflineEmbed = async (steamId, lastServerName, playerName = null) => {
    const embed = new EmbedBuilder()
        .setTitle('🔴 Player Offline')
        .setColor('#DC143C')
        .addFields(
            { name: 'Player', value: playerName || 'Unknown' },
            { name: 'SteamID', value: `\`${steamId}\`` },
            { name: 'Last Server', value: lastServerName || 'Unknown' },
            { name: 'BattleMetrics', value: `https://www.battlemetrics.com/rcon/players?filter[search]=${steamId}` }
        )
        .setTimestamp();

    try {
        await axios.post(WEBHOOK_PLAYER_ALERT, { embeds: [embed] });
    } catch (error) {
        console.error('Failed to send player offline alert webhook:', error);
    }
};

const sendServerChangeEmbed = async (steamId, fromServer, toServer, playerName = null) => {
    const embed = new EmbedBuilder()
        .setTitle('🔄 Player Changed Servers')
        .setColor('#FFA500')
        .addFields(
            { name: 'Player', value: playerName || 'Unknown' },
            { name: 'SteamID', value: `\`${steamId}\`` },
            { name: 'From Server', value: fromServer || 'Unknown' },
            { name: 'To Server', value: toServer || 'Unknown' },
            { name: 'BattleMetrics', value: `https://www.battlemetrics.com/rcon/players?filter[search]=${steamId}` }
        )
        .setTimestamp();

    try {
        await axios.post(WEBHOOK_PLAYER_ALERT, { embeds: [embed] });
    } catch (error) {
        console.error('Failed to send server change alert webhook:', error);
    }
};

const sendLogEmbed = async (action, user, steamId, addedBy = null, playerName = null) => {
    const isAdd = action === 'added';
    const fields = [
        { name: 'Player', value: playerName || 'Unknown' },
        { name: 'SteamID', value: `\`${steamId}\`` },
    ];
    if (isAdd) {
        fields.push({ name: 'Added by', value: user });
    } else {
        fields.push(
            { name: 'Originally Added by', value: addedBy || 'Unknown' },
            { name: 'Removed by', value: user }
        );
    }

    const embed = new EmbedBuilder()
        .setTitle(isAdd ? '📋 Player Watch Added' : '🗑️ Player Watch Removed')
        .setColor(isAdd ? '#FFA500' : '#FF5555')
        .addFields(fields)
        .setTimestamp();

    try {
        await axios.post(WEBHOOK_LOGGING, { embeds: [embed] });
    } catch (error) {
        console.error(`Failed to send ${action} log webhook:`, error.response?.data || error.message);
    }
};

const checkPlayers = async () => {
    if (watchlist.size === 0) return;
    console.log("🔁 Running player check...");

    for (const [steamId, info] of watchlist.entries()) {
        try {
            let bmPlayerId = info.bmId;
            
            // Step 1: Resolve Steam ID to BattleMetrics ID if not cached
            if (!bmPlayerId) {
                const searchRes = await bmAxios.get(`/players?filter[search]=${steamId}`);
                const player = searchRes.data.data?.[0];
                if (!player) {
                    console.log(`❌ No player found for SteamID ${steamId}`);
                    continue;
                }

                bmPlayerId = player.id;
                console.log(`🔍 Resolved ${steamId} to BM ID: ${bmPlayerId}`);
                
                // Cache the BM ID
                watchlist.set(steamId, { 
                    ...info, 
                    bmId: bmPlayerId 
                });
                await saveWatchlist();
            }

            // Step 2: Use public API to check current server status
            const publicRes = await axios.get(`https://api.battlemetrics.com/players/${bmPlayerId}?include=server`);
            const publicPlayer = publicRes.data.data;
            
            // Get player name from cache or API response
            let playerName = info.playerName;
            if (!playerName) {
                playerName = publicPlayer.attributes?.name || 'Unknown';
                // Update watchlist with cached name
                watchlist.set(steamId, { 
                    ...info, 
                    playerName: playerName 
                });
                await saveWatchlist();
            }
            
            // Debug logging
            console.log(`🔍 Checking servers for ${steamId} (BM ID: ${bmPlayerId}, Name: ${playerName})`);
            const includedServers = publicRes.data.included || [];
            console.log(`📊 Found ${includedServers.length} servers in included data`);
            
            // Check if player is online by looking for "online": true in included server meta
            let isOnline = false;
            let activeServerName = 'Unknown';
            
            for (const server of includedServers) {
                if (server.type === 'server' && server.meta?.online === true) {
                    isOnline = true;
                    activeServerName = server.attributes?.name || 'Unknown';
                    console.log(`✅ Found online server: ${activeServerName} (ID: ${server.id})`);
                    break;
                }
            }
            
            if (!isOnline) {
                console.log(`❌ No online servers found for ${steamId}`);
            }

            const wasOnline = info.notified;
            const previousServer = info.lastServer;
            console.log(`🧠 ${steamId} — online: ${isOnline}, wasOnline: ${wasOnline}, currentServer: ${activeServerName}, previousServer: ${previousServer}`);

            if (isOnline && !wasOnline) {
                // Player came online
                await sendPlayerOnlineEmbed(steamId, activeServerName, playerName);
                watchlist.set(steamId, { 
                    ...info, 
                    notified: true, 
                    lastServer: activeServerName 
                });
                await saveWatchlist();
                console.log(`✅ ${playerName} (${steamId}) came online on ${activeServerName}`);
            } else if (!isOnline && wasOnline) {
                // Player went offline
                const lastServerName = info.lastServer || 'Unknown';
                await sendPlayerOfflineEmbed(steamId, lastServerName, playerName);
                watchlist.set(steamId, { 
                    ...info, 
                    notified: false 
                });
                await saveWatchlist();
                console.log(`❌ ${playerName} (${steamId}) went offline from ${lastServerName}`);
            } else if (isOnline && wasOnline && activeServerName !== previousServer && previousServer) {
                // Player changed servers while online
                await sendServerChangeEmbed(steamId, previousServer, activeServerName, playerName);
                watchlist.set(steamId, { 
                    ...info, 
                    lastServer: activeServerName 
                });
                await saveWatchlist();
                console.log(`🔄 ${playerName} (${steamId}) changed servers from ${previousServer} to ${activeServerName}`);
            }
        } catch (err) {
            console.error(`❌ Error checking ${steamId}:`, err.response?.data || err.message);
        }
    }
};

client.on('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await loadWatchlist();
    setInterval(checkPlayers, parseInt(CHECK_INTERVAL, 10));
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options, user } = interaction;
    const steamId = options.getString('steam_id');

    try {
        if (commandName === 'watch') {
            if (watchlist.has(steamId)) {
                await interaction.reply({ content: `⚠️ Already watching \`${steamId}\``, flags: 64 });
            } else {
                // Defer reply IMMEDIATELY before any other operations
                await interaction.deferReply();
                
                // Add to watchlist immediately with unknown name
                watchlist.set(steamId, { 
                    added_by: user.username, 
                    notified: false, 
                    lastServer: null,
                    bmId: null, // Will be resolved on first check
                    playerName: null // Will be resolved on first check
                });
                await saveWatchlist();
                await interaction.editReply({ content: `✅ Now watching \`${steamId}\`` });
                
                // Get player name asynchronously for log embed (non-blocking)
                getPlayerName(steamId).then(playerName => {
                    // Update the watchlist with the name
                    const currentInfo = watchlist.get(steamId);
                    if (currentInfo) {
                        watchlist.set(steamId, { ...currentInfo, playerName });
                        saveWatchlist();
                    }
                    // Send log embed with name
                    sendLogEmbed('added', user.username, steamId, null, playerName);
                }).catch(error => {
                    console.error('Error fetching player name:', error);
                    // Send log embed without name
                    sendLogEmbed('added', user.username, steamId, null, 'Unknown');
                });
            }
        } else if (commandName === 'remove') {
            if (watchlist.has(steamId)) {
                // Defer reply immediately to avoid timeout
                await interaction.deferReply();
                
                const entry = watchlist.get(steamId);
                const addedBy = entry.added_by || 'Unknown';
                const cachedPlayerName = entry.playerName;
                
                watchlist.delete(steamId);
                await saveWatchlist();
                await interaction.editReply({ content: `✅ Removed \`${steamId}\`` });
                
                // Send log embed with cached name or fetch it
                if (cachedPlayerName) {
                    await sendLogEmbed('removed', user.username, steamId, addedBy, cachedPlayerName);
                } else {
                    // Fetch name asynchronously for log embed (non-blocking)
                    getPlayerName(steamId).then(playerName => {
                        sendLogEmbed('removed', user.username, steamId, addedBy, playerName);
                    }).catch(error => {
                        console.error('Error fetching player name for removal:', error);
                        sendLogEmbed('removed', user.username, steamId, addedBy, 'Unknown');
                    });
                }
            } else {
                await interaction.reply({ content: `❌ SteamID \`${steamId}\` not found`, flags: 64 });
            }
        } else if (commandName === 'list') {
            if (watchlist.size === 0) {
                return interaction.reply({ content: '📭 Watchlist is empty.', flags: 64 });
            }
            const embed = new EmbedBuilder()
                .setTitle('🔍 Current Watchlist')
                .setColor('#3498db')
                .setTimestamp();
            let desc = '';
            for (const [steamId, info] of watchlist.entries()) {
                const playerName = info.playerName || 'Unknown';
                desc += `• **${playerName}** (\`${steamId}\`) — added by **${info.added_by || 'Unknown'}**\n`;
            }
            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed], flags: 64 });
        } else if (commandName === 'status') {
            // Use same detection method as monitoring system
            const { data: { data: [player] = [] } } = await bmAxios.get(`/players?filter[search]=${steamId}`);
            if (!player) return interaction.reply({ content: `❌ Player not found.`, flags: 64 });
            
            const bmPlayerId = player.id;
            
            // Use public API to check current server status (same as monitoring)
            const publicRes = await axios.get(`https://api.battlemetrics.com/players/${bmPlayerId}?include=server`);
            const publicPlayer = publicRes.data.data;
            
            // Get player name from public API response
            const playerName = publicPlayer.attributes?.name || 'Unknown';
            
            // Check if player is online by looking for "online": true in included server meta
            let isOnline = false;
            let serverName = 'N/A';
            
            const includedServers = publicRes.data.included || [];
            for (const server of includedServers) {
                if (server.type === 'server' && server.meta?.online === true) {
                    isOnline = true;
                    serverName = server.attributes?.name || 'Unknown';
                    break;
                }
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔍 Player Status')
                .setColor(isOnline ? '#00cc66' : '#cc0000')
                .addFields(
                    { name: 'Player', value: playerName, inline: true },
                    { name: 'SteamID', value: `\`${steamId}\``, inline: true },
                    { name: 'Online?', value: isOnline ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'Server', value: serverName, inline: true },
                    { name: 'BattleMetrics', value: `https://www.battlemetrics.com/rcon/players?filter[search]=${steamId}` }
                )
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } else if (commandName === 'force_check') {
            if (watchlist.size === 0) {
                return interaction.reply({ content: '📭 Watchlist is empty. Add some players first!', flags: 64 });
            }

            await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL flag
            
            console.log('🔁 Force check triggered by user:', user.username);
            
            // Run the check function
            await checkPlayers();
            
            const embed = new EmbedBuilder()
                .setTitle('🔄 Force Check Complete')
                .setColor('#3498db')
                .setDescription(`✅ Checked ${watchlist.size} monitored players for online status.`)
                .addFields(
                    { name: 'Triggered by', value: user.username, inline: true },
                    { name: 'Players checked', value: watchlist.size.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('❌ Interaction error:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred while processing your command.', flags: 64 });
            } else if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ content: '❌ An error occurred while processing your command.' });
            }
        } catch (replyError) {
            console.error('❌ Failed to send error response:', replyError.message);
        }
    }
});

client.login(BOT_TOKEN);
