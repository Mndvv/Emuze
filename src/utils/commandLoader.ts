import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';
import { Command } from '../types';

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname, '../commands');
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const commandModule = await import(filePath);
      const command = commandModule.default;
      
      // More explicit type checking
      if (
        command && 
        typeof command === 'object' &&
        command.data && 
        typeof command.execute === 'function'
      ) {
        commands.set(command.data.name, command);
      } else {
        console.log(`[WARNING] Invalid command structure in ${filePath}`);
      }
    } catch (error) {
      console.error(`Error loading command from ${filePath}:`, error);
    }
  }

  return commands;
}