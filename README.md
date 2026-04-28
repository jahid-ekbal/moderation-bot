# Moderation Bot

A Discord bot built with TypeScript and Discord.js for server moderation with customizable bad word filtering and warning system.

## Features

- 🚫 **Bad Word Detection**: Automatically detects and removes messages containing bad words
- ⚠️ **Warning System**: Track user warnings with configurable thresholds
- 📊 **Multilingual Support**: Includes English, Bengali, Chinese, and Japanese bad words
- 🔧 **Customizable**: Easy configuration per server with guild-specific settings
- 📝 **Logging**: Logs moderation actions to designated channels

## Prerequisites

- Node.js 18+
- npm or yarn
- Discord Bot Token
- Discord Server with bot permissions

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/moderation-bot.git
cd moderation-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
```

4. Update `config.json` with your server settings and log channel IDs

## Configuration

### config.json

Configure per-server settings:

```json
{
  "guildId": {
    "logChannel": "channel_id"
  }
}
```

### badWords.json

The bot uses a comprehensive list of bad words across multiple languages. Add or remove words as needed.

### warnings.json

Tracks user warnings automatically. Format:

```json
{
  "userId": warning_count
}
```

## Usage

Run the bot:

```bash
npm start
```

Or with ts-node:

```bash
ts-node bot.ts
```

## Project Structure

- `bot.ts` - Main bot file with client initialization and event handlers
- `config.json` - Server-specific configuration
- `badWords.json` - List of prohibited words (1000+ entries in multiple languages)
- `warnings.json` - User warning tracking
- `package.json` - Dependencies and scripts

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on the repository.
