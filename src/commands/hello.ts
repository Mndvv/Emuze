import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say hello!')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('Your name')
        .setRequired(false)
    ),
  async execute(interaction) {
    const name = interaction.options.getString('name') || 'stranger';
    await interaction.reply(`Hello, ${name}!`);
  }
} as Command;