import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getMusicQueueManager } from '../utils/musicQueueManager';
import { CustomClient } from '../types';

export const command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music in the voice channel')
    .addStringOption((option) =>
      option.setName('query')
        .setDescription('The song name or URL to play')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as CustomClient;
    const musicManager = getMusicQueueManager(client);

    try {
      await musicManager.play(interaction);
    } catch (error) {
      console.error('Play Error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('❌ Error: Could not play the song.');
      } else {
        await interaction.followUp('❌ Error: Could not play the song.');
      }
    }
  },
};

export default command;