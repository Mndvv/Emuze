// src/types/index.ts
import { 
  Collection, 
  ChatInputCommandInteraction, 
  SlashCommandBuilder,
  Client as DiscordClient
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Create a custom client type that explicitly includes commands
export interface CustomClient extends DiscordClient {
  commands: Collection<string, Command>;
}

//MUSIC
import { 
  AudioPlayer, 
  VoiceConnection 
} from '@discordjs/voice';

export interface MusicTrack {
  title: string;
  url: string;
  requester: string;
  duration?: string;
}

export interface ServerQueue {
  textChannel: any;
  voiceChannel: any;
  connection: VoiceConnection | null;
  songs: MusicTrack[];
  volume: number;
  playing: boolean;
  player: AudioPlayer | null;
}

export interface GlobalQueue {
  [serverId: string]: ServerQueue;
}