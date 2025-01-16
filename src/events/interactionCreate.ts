import { 
    Interaction, 
    Events, 
    Collection 
  } from 'discord.js';
  import { Command } from '../types';
  
  export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, commands: Collection<string, Command>) {
      if (!interaction.isChatInputCommand()) return;
  
      const command = commands.get(interaction.commandName);
  
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
  
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
          });
        }
      }
    }
  };