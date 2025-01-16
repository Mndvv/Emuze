import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from '../types';
import { getMusicQueueManager } from '../utils/musicQueueManager';
import { CustomClient } from '../types';

const skipCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply('This command can only be used in a server!');
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      await interaction.reply('You must be in a voice channel to skip songs!');
      return;
    }

    try {
      const musicQueueManager = getMusicQueueManager(interaction.client as CustomClient);
      await musicQueueManager.skip(interaction);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      await interaction.reply(`❌ Error: ${errorMessage}`);
    }
  },
} satisfies Command;

export default skipCommand;