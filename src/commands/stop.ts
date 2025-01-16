import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getMusicQueueManager } from '../utils/musicQueueManager';
import { CustomClient } from '../types';

export const command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing music and clear the queue'),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as CustomClient;
    const musicManager = getMusicQueueManager(client);

    try {
      await musicManager.stop(interaction);
    } catch (error) {
      console.error('Stop Error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('❌ Error: Could not stop the music.');
      } else {
        await interaction.followUp('❌ Error: Could not stop the music.');
      }
    }
  },
};

export default command;