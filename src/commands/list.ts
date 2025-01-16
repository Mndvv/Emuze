// commands/list.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getMusicQueueManager } from '../utils/musicQueueManager';
import { CustomClient } from '../types';

export const command = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all available songs in the library'),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as CustomClient;
    const musicManager = getMusicQueueManager(client);

    try {
      await musicManager.list(interaction);
    } catch (error) {
      console.error('List Error:', error);
      await interaction.reply('❌ Error: Could not list songs.');
    }
  },
};

export default command;
