// musicQueueManager.ts
import { 
  Client, 
  TextChannel, 
  ChatInputCommandInteraction, 
  GuildMember, 
  VoiceBasedChannel 
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

interface QueueItem {
  filePath: string;
  name: string;
  requester: string;
}

class MusicQueueManager {
  private queues: Map<string, QueueItem[]>;
  private players: Map<string, any>;
  private readonly musicFolder = join(__dirname, '../../music');  // Go up two levels: one from dist, one from src

  constructor(client: CustomClient) {
    this.queues = new Map();
    this.players = new Map();
  }

  private getMusicFiles(): string[] {
    try {
      return readdirSync(this.musicFolder).filter(file => 
        file.endsWith('.mp3') || file.endsWith('.wav')
      );
    } catch (error) {
      console.error('Error reading music folder:', error);
      return [];
    }
  }

  private async playNext(guildId: string, textChannel: TextChannel): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) {
      this.players.delete(guildId);
      const connection = getVoiceConnection(guildId);
      connection?.destroy();
      return;
    }

    const song = queue.shift();
    if (!song) return;

    try {
      const resource = createAudioResource(song.filePath);
      const player = this.players.get(guildId);
      
      player.play(resource);
      await textChannel.send(
        `▶️ Playing: \`${song.name}\` - Requested by: ${song.requester}`
      );
    } catch (error) {
      console.error('Error playing song:', error);
      await textChannel.send('❌ Error playing the current song, skipping...');
      this.playNext(guildId, textChannel);
    }
  }

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
      const matchingSong = availableSongs.find(song => 
        song.toLowerCase().replace(/\.[^/.]+$/, "").includes(query)
      );

      if (!matchingSong) {
        await interaction.reply({ 
          content: '❌ Song not found in library! Use /list to see available songs.', 
          ephemeral: true 
        });
        return;
      }

      const guildId = interaction.guildId!;
      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }

      const songItem: QueueItem = {
        filePath: join(this.musicFolder, matchingSong),
        name: matchingSong.replace(/\.[^/.]+$/, ""),
        requester: member.user.tag
      };

      const queue = this.queues.get(guildId)!;
      queue.push(songItem);

      if (!this.players.has(guildId)) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild!.voiceAdapterCreator
        });

        const player = createAudioPlayer();
        this.players.set(guildId, player);
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
          this.playNext(guildId, interaction.channel as TextChannel);
        });

        await this.playNext(guildId, interaction.channel as TextChannel);
        await interaction.reply('🎵 Starting playback!');
      } else {
        await interaction.reply(
          `📝 Added \`${songItem.name}\` to the queue`
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

  public async list(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const songs = this.getMusicFiles();
      if (songs.length === 0) {
        await interaction.reply('No songs found in the music library!');
        return;
      }

      const songList = songs
        .map(song => `• ${song.replace(/\.[^/.]+$/, "")}`)
        .join('\n');

      await interaction.reply(`**Available Songs:**\n${songList}`);
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
      const player = this.players.get(guildId);
      
      if (!player) {
        await interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
        return;
      }

      player.stop();
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
      const player = this.players.get(guildId);
      
      if (!player) {
        await interaction.reply({ content: '❌ No music is playing!', ephemeral: true });
        return;
      }

      this.queues.delete(guildId);
      player.stop();
      this.players.delete(guildId);
      
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