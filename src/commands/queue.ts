import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getMusicQueueManager } from '../utils/musicQueueManager';
import { CustomClient } from '../types';

export const command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show or manage the music queue')
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show the current queue')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
          option
            .setName('position')
            .setDescription('Position of the song to remove')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear the entire queue')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shuffle')
        .setDescription('Shuffle the current queue')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('move')
        .setDescription('Move a song to a different position in the queue')
        .addIntegerOption(option =>
          option
            .setName('from')
            .setDescription('Current position of the song')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('to')
            .setDescription('New position for the song')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as CustomClient;
    const musicManager = getMusicQueueManager(client);
    const subcommand = interaction.options.getSubcommand();

    // Check if user is in a voice channel for commands that modify the queue
    if (subcommand !== 'show') {
      const member = interaction.member as any;
      if (!member.voice?.channel) {
        await interaction.reply({ 
          content: '❌ You must be in a voice channel to modify the queue!', 
          ephemeral: true 
        });
        return;
      }
    }

    try {
      switch (subcommand) {
        case 'show':
          await musicManager.showQueue(interaction);
          break;

        case 'remove':
          // Check if user is the requester or has manage messages permission
          const position = interaction.options.getInteger('position', true);
          const canRemove = await musicManager.canModifyQueueItem(
            interaction.guildId!, 
            position, 
            interaction.user.tag,
            interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || false
          );

          if (!canRemove) {
            await interaction.reply({ 
              content: '❌ You can only remove songs you requested, unless you have the Manage Messages permission.', 
              ephemeral: true 
            });
            return;
          }
          await musicManager.remove(interaction);
          break;

        case 'clear':
          // Check if user has manage messages permission
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({ 
              content: '❌ You need the Manage Messages permission to clear the queue.', 
              ephemeral: true 
            });
            return;
          }
          await musicManager.clear(interaction);
          break;

        case 'shuffle':
          await musicManager.shuffle(interaction);
          break;

        case 'move':
          const fromPos = interaction.options.getInteger('from', true);
          const toPos = interaction.options.getInteger('to', true);
          const canMove = await musicManager.canModifyQueueItem(
            interaction.guildId!, 
            fromPos,
            interaction.user.tag,
            interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || false
          );

          if (!canMove) {
            await interaction.reply({ 
              content: '❌ You can only move songs you requested, unless you have the Manage Messages permission.', 
              ephemeral: true 
            });
            return;
          }
          await musicManager.move(interaction);
          break;

        default:
          await interaction.reply({ 
            content: '❌ Unknown subcommand.', 
            ephemeral: true 
          });
      }
    } catch (error) {
      console.error('Queue Command Error:', error);
      await interaction.reply({
        content: '❌ Failed to process queue command.',
        ephemeral: true
      });
    }
  },
};

export default command;