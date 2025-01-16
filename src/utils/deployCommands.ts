import { REST, Routes } from 'discord.js';
import { loadCommands } from './commandLoader';
import * as dotenv from 'dotenv';

dotenv.config();

export async function deployCommands() {
  const commands = await loadCommands();
  const commandsData = commands.map(command => command.data.toJSON());

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID!, 
        process.env.GUILD_ID!
      ),
      { body: commandsData }
    ) as any;

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
}
