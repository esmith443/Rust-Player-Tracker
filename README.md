# BattleMetrics Player Tracker Bot

A Discord bot that monitors player activity on game servers via BattleMetrics API and sends real-time notifications when tracked players come online or go offline.

## 🎯 Features

- **Real-time Player Tracking**: Monitor specific Steam users across game servers
- **Dual Notifications**: Get notified when players come online AND when they go offline
- **Server Information**: See which server the player joined/left
- **Persistent Watchlist**: Your tracked players are saved between bot restarts
- **BattleMetrics Integration**: Direct links to player profiles on BattleMetrics
- **Logging System**: Separate webhook for tracking watchlist changes
- **Easy Management**: Simple slash commands to add, remove, and manage tracked players

## 📋 Requirements

- Node.js 16.0.0 or higher
- Discord Bot Token
- Discord Application Client ID
- BattleMetrics API Token
- Discord Webhook URLs (2 webhooks recommended)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bmtracker-discord-bot.git
   cd bmtracker-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure your environment variables** (see Configuration section below)

5. **Deploy slash commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the bot**
   ```bash
   node index.js
   ```

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Discord Configuration
BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_client_id_here

# Webhook URLs
WEBHOOK_PLAYER_ALERT=your_player_alert_webhook_url_here
WEBHOOK_LOGGING=your_logging_webhook_url_here

# BattleMetrics API
BATTLEMETRICS_TOKEN=your_battlemetrics_api_token_here

# Bot Settings
CHECK_INTERVAL=30000
```

### Getting Required Tokens

#### Discord Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token for `BOT_TOKEN`
5. Copy the application ID for `DISCORD_CLIENT_ID`
6. Create two webhooks in your Discord channels:
   - One for player alerts (`WEBHOOK_PLAYER_ALERT`)
   - One for logging watchlist changes (`WEBHOOK_LOGGING`)

#### BattleMetrics API Token
1. Go to [BattleMetrics Developer](https://www.battlemetrics.com/developers)
2. Log in to your BattleMetrics account
3. Create a new API token
4. Copy the token for `BATTLEMETRICS_TOKEN`

#### Bot Permissions
Ensure your Discord bot has the following permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Read Message History`

## 🎮 Commands

The bot uses Discord slash commands for easy interaction:

### `/watch`
Add a player to the watchlist for monitoring
- **steam_id**: The Steam ID (64-bit format) of the player to track

**Example:**
```
/watch steam_id:76561198123456789
```

### `/remove`
Remove a player from the watchlist
- **steam_id**: The Steam ID of the player to remove

**Example:**
```
/remove steam_id:76561198123456789
```

### `/list`
Display all currently tracked players and who added them

**Example:**
```
/list
```

### `/status`
Check the current online/offline status of a specific player
- **steam_id**: The Steam ID of the player to check

**Example:**
```
/status steam_id:76561198123456789
```

### `/force_check`
Force an immediate check of all monitored players for online status
- **No parameters required**
- **Useful for**: Testing, immediate updates, or checking status outside the normal 5-minute interval

**Example:**
```
/force_check
```

**When to use:**
- After adding new players to test monitoring
- When you need immediate status updates
- For debugging or testing the monitoring system
- During important events when you want real-time checks

## 📋 All Available Commands

The bot supports these 5 slash commands:

1. **`/watch`** - Add a player to the watchlist
2. **`/remove`** - Remove a player from the watchlist  
3. **`/list`** - Show all tracked players
4. **`/status`** - Check current player status
5. **`/force_check`** - Force check all monitored players

## 🔔 Notifications

The bot sends two types of notifications:

### Player Online Notification (Green)
- **Title**: 🎮 Player Online
- **Color**: Green (#2E8B57)
- **Information**: SteamID, Current Server, BattleMetrics link

### Player Offline Notification (Red)
- **Title**: 🔴 Player Offline
- **Color**: Red (#DC143C)
- **Information**: SteamID, Last Server, BattleMetrics link

### Logging Notifications
- **Watchlist additions**: Shows who added which player
- **Watchlist removals**: Shows who removed which player and who originally added them

## 🔧 Usage Examples

### Adding Players to Watchlist
```bash
# Add a player to track
/watch steam_id:76561198123456789

# The bot will respond with confirmation
✅ Now watching `76561198123456789`
```

### Checking Player Status
```bash
# Check if a player is currently online
/status steam_id:76561198123456789

# Response shows current status and server (if online)
```

### Managing Your Watchlist
```bash
# View all tracked players
/list

# Remove a player from tracking
/remove steam_id:76561198123456789

# Force check all monitored players immediately
/force_check
```

## 📊 How It Works

1. **Monitoring Loop**: The bot checks all tracked players every 30 seconds (configurable)
2. **Two-Step API Process**:
   - **Step 1**: Uses private BattleMetrics API to resolve Steam ID to BattleMetrics player ID
   - **Step 2**: Uses public BattleMetrics API to check current server status
3. **Efficient Caching**: Caches BattleMetrics player IDs to avoid repeated Steam ID lookups
4. **Online Detection**: Searches for `"online": true` in server meta data from included servers
5. **State Tracking**: Maintains player online/offline state to prevent notification spam
6. **Dual Notifications**: 
   - Sends notification when player comes online
   - Sends notification when player goes offline
7. **Data Persistence**: Stores watchlist with cached BM IDs in `watchlist.json` file

## 🗂️ Data Structure

The bot maintains a watchlist with the following structure:
```json
{
  "76561198123456789": {
    "added_by": "username",
    "notified": false,
    "lastServer": "Server Name",
    "bmId": "1158355490"
  }
}
```

**Fields Explanation:**
- `added_by`: Discord username who added the player
- `notified`: Current notification state (true = online, false = offline)
- `lastServer`: Name of the last server the player was seen on
- `bmId`: Cached BattleMetrics player ID to avoid repeated API lookups

## 🚨 Troubleshooting

### Common Issues

#### "Failed to load watchlist"
- Ensure the bot has read/write permissions in its directory
- Check that `watchlist.json` exists and has valid JSON format

#### "Error checking player"
- Verify your `BATTLEMETRICS_TOKEN` is valid and has proper permissions
- Check that the Steam ID format is correct (64-bit Steam ID)

#### "Failed to send webhook"
- Ensure webhook URLs are valid and not expired
- Check that the webhook has permission to send messages in the target channel

#### "No player found for SteamID"
- Verify the Steam ID is correct
- Player might not exist in BattleMetrics database
- Player might have never played on tracked servers

#### "Found 0 servers in relationships"
- This is normal behavior - the bot uses the `included` servers array for detection
- Player's `relationships` object may be empty even when they're online
- Bot automatically checks the `included` array for `"online": true` status

### Steam ID Format
The bot requires **64-bit Steam IDs** (e.g., `76561198123456789`). You can convert other formats using:
- [SteamID.io](https://steamid.io/)
- [Steam ID Converter](https://steamidfinder.com/)

### Rate Limiting
- The bot respects BattleMetrics API rate limits
- Default check interval is 30 seconds (configurable via `CHECK_INTERVAL`)
- If you encounter rate limit errors, increase the `CHECK_INTERVAL` value

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BOT_TOKEN` | Discord bot token | - | Yes |
| `DISCORD_CLIENT_ID` | Discord application client ID | - | Yes |
| `WEBHOOK_PLAYER_ALERT` | Webhook for player notifications | - | Yes |
| `WEBHOOK_LOGGING` | Webhook for logging events | - | Yes |
| `BATTLEMETRICS_TOKEN` | BattleMetrics API token | - | Yes |
| `CHECK_INTERVAL` | Check interval in milliseconds | 30000 | No |

### Customization

You can customize the bot by modifying:
- **Check Interval**: Change `CHECK_INTERVAL` in `.env`
- **Embed Colors**: Modify colors in the embed creation functions
- **Notification Content**: Update embed titles and descriptions
- **Logging Level**: Add more console.log statements for debugging

## 📈 Performance

- **Memory Usage**: Lightweight, typically uses <50MB RAM
- **API Calls**: 
  - ~1 private API call per new player (one-time Steam ID resolution)
  - ~1 public API call per tracked player per check cycle
  - Cached BM IDs reduce API usage significantly
- **Scalability**: Can handle hundreds of tracked players efficiently
- **Reliability**: Includes error handling and automatic retries
- **Optimization**: BattleMetrics ID caching minimizes API rate limit issues

## 🔮 Future Features

- [ ] Web dashboard for managing watchlist
- [ ] Player statistics and activity history
- [ ] Multiple server filtering
- [ ] Custom notification messages
- [ ] Role mentions for specific players
- [ ] Bulk player import/export
- [ ] Advanced filtering options

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This bot uses the BattleMetrics API to track player activity. Please ensure you comply with:
- BattleMetrics Terms of Service
- Discord Terms of Service
- Applicable privacy laws and regulations
- Obtain proper consent before tracking players

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Verify your environment variables are correct
4. Create an issue on GitHub with:
   - Detailed description of the problem
   - Console logs (remove sensitive tokens)
   - Your environment (Node.js version, OS, etc.)

## 📚 Additional Resources

- [BattleMetrics API Documentation](https://www.battlemetrics.com/developers/documentation)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Discord.js Documentation](https://discord.js.org/#/docs)
- [Node.js Documentation](https://nodejs.org/en/docs/)

---

**Made with ❤️ for the gaming community**

*Track your friends, enemies, and favorite players across all your favorite game servers!*
