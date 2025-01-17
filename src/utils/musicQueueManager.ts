import { 
  Client, 
  TextChannel, 
  ChatInputCommandInteraction, 
  GuildMember, 
  VoiceBasedChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionCollector
} from 'discord.js';
import { 
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} from '@discordjs/voice';
import { CustomClient } from '../types';
import { readdirSync } from 'fs';
import { join } from 'path';
import { stringSimilarity } from 'string-similarity-js';
import { getAudioDurationInSeconds } from 'get-audio-duration';

interface QueueItem {
  filePath: string;
  name: string;
  requester: string;
  position: number;
  duration: number;  // Duration in seconds
  startTime?: number;  // When the song started playing
}

interface GuildMusicState {
  queue: QueueItem[];
  currentSong: QueueItem | null;
  player: any;
}

class MusicQueueManager {
  private guildStates: Map<string, GuildMusicState>;
  private queues: Map<string, QueueItem[]>;
  private players: Map<string, any>;
  private readonly musicFolder = join(__dirname, '../../music');
  private stringSimilarity: typeof stringSimilarity;  // Add this property

  constructor(client: CustomClient) {
    this.queues = new Map();
    this.players = new Map();
    this.guildStates = new Map();
    this.stringSimilarity = stringSimilarity;  // Initialize in constructor
  }

  private getGuildState(guildId: string): GuildMusicState {
    if (!this.guildStates.has(guildId)) {
      this.guildStates.set(guildId, {
        queue: [],
        currentSong: null,
        player: createAudioPlayer()
      });
    }
    return this.guildStates.get(guildId)!;
  }

  private getRemainingTime(song: QueueItem): number {
    if (!song.startTime) return song.duration;
    const elapsed = (Date.now() - song.startTime) / 1000;
    return Math.max(0, song.duration - elapsed);
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private getMusicFiles(): string[] {
    try {
      return readdirSync(this.musicFolder).filter(file => 
        file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.opus')
      );
    } catch (error) {
      console.error('Error reading music folder:', error);
      return [];
    }
  }

  // Add this new method for fuzzy search
  private findBestMatch(query: string, songs: string[]): string | null {
    if (songs.length === 0) return null;

    // First try to find exact matches in parts of the filename
    const normalizedQuery = query.toLowerCase();
    for (const song of songs) {
      const parts = song.toLowerCase().replace(/\.[^/.]+$/, "").split(/[-_ ]/);
      if (parts.some(part => part === normalizedQuery)) {
        return song;
      }
    }

    // If no exact match found, use fuzzy matching
    const similarities = songs.map(song => ({
      song,
      similarity: this.stringSimilarity(
        query,
        song.toLowerCase().replace(/\.[^/.]+$/, "")
      )
    }));

    const bestMatch = similarities.reduce((best, current) => 
      current.similarity > best.similarity ? current : best
    );

    return bestMatch.similarity > 0.3 ? bestMatch.song : null;
  }

  // Update your play method to use fuzzy search
  public async play(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const member = interaction.member as GuildMember;
      const voiceChannel = member.voice?.channel as VoiceBasedChannel;
  
      if (!voiceChannel) {
        await interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        return;
      }
  
      const query = interaction.options.getString('query', true).toLowerCase();
      const availableSongs = this.getMusicFiles();
      const matchingSong = this.findBestMatch(query, availableSongs);
  
      if (!matchingSong) {
        await interaction.reply({ 
          content: '❌ No matching song found! Use /list to see available songs.', 
          ephemeral: true 
        });
        return;
      }
  
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      
      const filePath = join(this.musicFolder, matchingSong);
      const duration = await getAudioDurationInSeconds(filePath);
  
      const songItem: QueueItem = {
        filePath,
        name: matchingSong.replace(/\.[^/.]+$/, ""),
        requester: member.user.tag,
        position: state.queue.length + 1,
        duration
      };
  
      // Always add to queue first
      state.queue.push(songItem);
  
      // If nothing is playing, start playback
      if (!state.currentSong) {
        const nextSong = state.queue.shift()!;
        await this.startPlaying(guildId, voiceChannel, nextSong, interaction.channel as TextChannel);
        await interaction.reply('🎵 Starting playback!');
      } else {
        await interaction.reply(
          `📝 Added \`${songItem.name}\` to the queue (${this.formatTime(duration)})`
        );
      }
  
    } catch (error) {
      console.error('Play Error:', error);
      await interaction.reply({ 
        content: '❌ An error occurred while processing your request.', 
        ephemeral: true 
      });
    }
  }

  private async startPlaying(guildId: string, voiceChannel: VoiceBasedChannel, song: QueueItem, textChannel: TextChannel): Promise<void> {
    const state = this.getGuildState(guildId);
    
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    connection.subscribe(state.player);

    state.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId, textChannel);
    });

    state.currentSong = song;
    song.startTime = Date.now();
    
    const resource = createAudioResource(song.filePath);
    state.player.play(resource);

    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing')
      .setColor('#0099ff')
      .setDescription(`\`${song.name}\` (${this.formatTime(song.duration)})`)
      .setFooter({ text: `Requested by: ${song.requester}` });

    await textChannel.send({ embeds: [embed] });
  }

  private async playNext(guildId: string, channel: TextChannel): Promise<void> {
    try {
      const state = this.getGuildState(guildId);
      
      if (state.queue.length === 0) {
        state.currentSong = null;
        const connection = getVoiceConnection(guildId);
        connection?.destroy();
        await channel.send('Queue finished! 👋');
        return;
      }

      const nextSong = state.queue.shift()!;
      state.queue.forEach((item, index) => {
        item.position = index + 1;
      });

      nextSong.startTime = Date.now();
      state.currentSong = nextSong;

      try {
        const resource = createAudioResource(nextSong.filePath);
        state.player.play(resource);
        
        const embed = new EmbedBuilder()
          .setTitle('🎵 Now Playing')
          .setColor('#0099ff')
          .setDescription(`\`${nextSong.name}\` (${this.formatTime(nextSong.duration)})`)
          .setFooter({ text: `Requested by: ${nextSong.requester}` });

        await channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error playing file:', error);
        await channel.send(`❌ Error playing \`${nextSong.name}\`. Skipping to next song...`);
        this.playNext(guildId, channel);
      }
    } catch (error) {
      console.error('PlayNext Error:', error);
      await channel.send('❌ An error occurred while playing the next song.');
    }
  }

  public async remove(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      const position = interaction.options.getInteger('position', true);
  
      if (!state.queue || state.queue.length === 0) {
        await interaction.reply('Queue is empty!');
        return;
      }
  
      if (position < 1 || position > state.queue.length) {
        await interaction.reply('Invalid position! Use /queue show to see the current queue.');
        return;
      }
  
      // Remove the song at the specified position
      const removed = state.queue.splice(position - 1, 1)[0];
  
      // Update positions for remaining items
      state.queue.forEach((item, index) => {
        item.position = index + 1;
      });
  
      await interaction.reply(`Removed \`${removed.name}\` from the queue.`);
      await this.showQueue(interaction);
    } catch (error) {
      console.error('Remove Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to remove song from queue.', 
        ephemeral: true 
      });
    }
  }

  public async canModifyQueueItem(
    guildId: string,
    position: number,
    userTag: string,
    hasManageMessages: boolean
  ): Promise<boolean> {
    const state = this.getGuildState(guildId);
    if (position < 1 || position > state.queue.length) return false;
    if (hasManageMessages) return true;
    return state.queue[position - 1].requester === userTag;
  }
  
  public async shuffle(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
  
      if (!state.queue || state.queue.length < 2) {
        await interaction.reply('Not enough songs in the queue to shuffle!');
        return;
      }
  
      // Fisher-Yates shuffle algorithm
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
  
      // Update positions
      state.queue.forEach((item, index) => {
        item.position = index + 1;
      });
  
      await interaction.reply('🔀 Queue has been shuffled!');
      await this.showQueue(interaction);
    } catch (error) {
      console.error('Shuffle Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to shuffle queue.', 
        ephemeral: true 
      });
    }
  }
  
  public async move(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      const fromPos = interaction.options.getInteger('from', true);
      const toPos = interaction.options.getInteger('to', true);
  
      if (!state.queue || state.queue.length === 0) {
        await interaction.reply('Queue is empty!');
        return;
      }
  
      if (fromPos < 1 || fromPos > state.queue.length || 
          toPos < 1 || toPos > state.queue.length) {
        await interaction.reply('Invalid position! Use /queue show to see the current queue.');
        return;
      }
  
      // Move the song
      const [song] = state.queue.splice(fromPos - 1, 1);
      state.queue.splice(toPos - 1, 0, song);
  
      // Update positions
      state.queue.forEach((item, index) => {
        item.position = index + 1;
      });
  
      await interaction.reply(`Moved \`${song.name}\` from position ${fromPos} to ${toPos}`);
      await this.showQueue(interaction);
    } catch (error) {
      console.error('Move Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to move song.', 
        ephemeral: true 
      });
    }
  }

  // Add these new methods for queue management
  public async showQueue(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      let description = '';
      
      // Always show current song section
      description += '🎵 **Now Playing:**\n';
      if (state.currentSong) {
        const remainingTime = this.getRemainingTime(state.currentSong);
        description += `${state.currentSong.name} - ${this.formatTime(remainingTime)} left`;
      } else {
        description += 'No song playing';
      }
      description += '\n\n';
  
      // Always show queue section
      description += '**Up Next:**\n';
      if (state.queue.length > 0) {
        description += state.queue.map((item, index) => 
          `${index + 1}. \`${item.name}\` (${this.formatTime(item.duration)}) - Requested by: ${item.requester}`
        ).join('\n');
      } else {
        description += 'No songs in queue';
      }
  
      const embed = new EmbedBuilder()
        .setTitle('🎵 Music Queue')
        .setColor('#0099ff')
        .setDescription(description)
        .setFooter({ text: `${state.queue.length} songs in queue` });
  
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Queue Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to display queue.', 
        ephemeral: true 
      });
    }
  }

  public async clear(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
  
      if (!state.queue || state.queue.length === 0) {
        await interaction.reply('Queue is already empty!');
        return;
      }
  
      state.queue = [];
      await interaction.reply('🧹 Cleared the queue!');
      await this.showQueue(interaction);
    } catch (error) {
      console.error('Clear Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to clear queue.', 
        ephemeral: true 
      });
    }
  }
  

  // Add a new method to create an embed for a specific page
  private createListEmbed(songs: string[], page: number, totalPages: number): EmbedBuilder {
    const start = (page - 1) * 10;
    const end = start + 10;
    const songList = songs.slice(start, end)
      .map((song, index) => `**${start + index + 1}.** ${song.replace(/\.[^/.]+$/, "")}`)
      .join('\n');

    return new EmbedBuilder()
      .setTitle('🎵 Available Songs')
      .setDescription(songList)
      .setFooter({ text: `Page ${page} of ${totalPages}` });
  }

  public async list(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const songs = this.getMusicFiles();
      if (songs.length === 0) {
        await interaction.reply('No songs found in the music library!');
        return;
      }

      const totalPages = Math.ceil(songs.length / 10);
      let currentPage = 1;

      const embed = this.createListEmbed(songs, currentPage, totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages)
        );

      const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'You cannot interact with this button.', ephemeral: true });
          return;
        }

        if (i.customId === 'prev' && currentPage > 1) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < totalPages) {
          currentPage++;
        }

        const newEmbed = this.createListEmbed(songs, currentPage, totalPages);

        await i.update({
          embeds: [newEmbed],
          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('prev')
                  .setLabel('Previous')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === 1),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('Next')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === totalPages)
              )
          ]
        });
      });

      collector.on('end', async () => {
        await message.edit({ components: [] });
      });
    } catch (error) {
      console.error('List Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to list songs.', 
        ephemeral: true 
      });
    }
  }

  public async skip(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      
      if (!state.currentSong) {
        await interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
        return;
      }
  
      state.player.stop(); // This will trigger the 'idle' event which calls playNext
      await interaction.reply('⏭️ Skipped the current song!');
    } catch (error) {
      console.error('Skip Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to skip the song.', 
        ephemeral: true 
      });
    }
  }

  public async stop(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const state = this.getGuildState(guildId);
      
      if (!state.currentSong) {
        await interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
        return;
      }
  
      state.queue = [];
      state.currentSong = null;
      state.player.stop();
      
      const connection = getVoiceConnection(guildId);
      connection?.destroy();
  
      await interaction.reply('⏹️ Stopped the music and cleared the queue!');
    } catch (error) {
      console.error('Stop Error:', error);
      await interaction.reply({ 
        content: '❌ Failed to stop the music.', 
        ephemeral: true 
      });
    }
  }
}

export default MusicQueueManager;

export function getMusicQueueManager(client: CustomClient): MusicQueueManager {
  return new MusicQueueManager(client);
}