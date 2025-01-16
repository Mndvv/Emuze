import { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    Partials,
    Events
  } from 'discord.js';
  import * as dotenv from 'dotenv';
  import { loadCommands } from './utils/commandLoader';
  import { deployCommands } from './utils/deployCommands';
  import interactionCreate from './events/interactionCreate';
  import { Command, CustomClient } from './types';
  // import { initializeMusicQueueManager } from './utils/musicQueueManager'
  import * as ffmpeg from 'ffmpeg-static';
  
  // Load environment variables
  dotenv.config();
  
  // Create client with necessary intents
 // Create client with necessary intents
const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates, // Add this for music bot
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.Reaction,
    ]
}) as CustomClient;
  
  // Initialize commands collection
  (client as CustomClient).commands = new Collection<string, Command>();
  
  // Ready event - runs when bot successfully connects
  client.once(Events.ClientReady, async () => {
    console.log(`🤖 Logged in as ${client.user?.tag}!`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} servers`);
    // initializeMusicQueueManager(client as CustomClient);
    // Load commands and deploy them
    try {
      (client as CustomClient).commands = await loadCommands();
      await deployCommands();
      console.log(`📦 Loaded ${(client as CustomClient).commands.size} commands`);
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  });
  
  // Interaction create event handler
  client.on(Events.InteractionCreate, (interaction) => 
    interactionCreate.execute(interaction, (client as CustomClient).commands)
  );
  
  // Optional: Log when bot joins a new server
  client.on(Events.GuildCreate, (guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  });
  
  // Optional: Error handling
  client.on(Events.Error, (error) => {
    console.error('Discord client error:', error);
  });
  
  // Process-level error handling
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
  });
  
  // Login to Discord
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('🟢 Bot successfully logged in'))
    .catch((error) => console.error('🔴 Failed to log in:', error));