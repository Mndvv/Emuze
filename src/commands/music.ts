import YTMusic from 'ytmusic-api';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types';

// Define a type for the track to help with TypeScript
interface MusicTrack {
  type: string;
  name: string;
  artist?: {
    name: string;
  };
  album?: {
    name: string;
  };
  duration?: number;
  thumbnails?: Array<{
    url: string;
  }>;
  videoId: string;
}

export default {
  data: new SlashCommandBuilder()
    .setName('musicsearch')
    .setDescription('Search for music on YouTube Music')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Music or artist to search for')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    // Defer the reply to handle potentially longer search times
    await interaction.deferReply();
    // Get the search query from the interaction options
    const query = interaction.options.getString('query', true);
    try {
      // Initialize YTMusic client
      const ytmusic = new YTMusic();
      await ytmusic.initialize();
      // Perform the search
      const searchResults = await ytmusic.search(query);
      // If no results found
      if (!searchResults || searchResults.length === 0) {
        await interaction.editReply(`No music found for query: ${query}`);
        return;
      }
      // Take the top 5 results
      const topResults = searchResults.slice(0, 5) as MusicTrack[];
      // Create an embed to display search results
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🎵 Music Search Results for "${query}"`)
        .setDescription('Top 5 Matching Tracks')
        .setTimestamp();
      // Add fields for each result
      topResults.forEach((track: MusicTrack, index: number) => {
        // Safely extract information based on track type
        const artistName = track.type === 'SONG' ? track.artist?.name ?? 'Unknown Artist' : 'Unknown Artist';
        const albumName = track.type === 'SONG' && track.album ? track.album.name : 'Unknown Album';
        const duration = track.type === 'SONG' || track.type === 'VIDEO' ? track.duration : null;
        const thumbnailUrl = track.thumbnails && track.thumbnails.length > 0 ? track.thumbnails[0].url : '';

        embed.addFields({
          name: `${index + 1}. ${track.name}`,
          value: `
          **Artist:** ${artistName}
          **Album:** ${albumName}
          **Duration:** ${formatDuration(duration)}
          **Video ID:** [YouTube](https://music.youtube.com/watch?v=${track.videoId})
          `,
          inline: false
        });
      });
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Music search error:', error);
      await interaction.editReply({
        content: 'An error occurred while searching for music.',
        embeds: []
      });
    }
  }
} as Command;

// Helper function to format duration
function formatDuration(seconds?: number | null): string {
  if (!seconds) return 'Unknown';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}