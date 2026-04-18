require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Управление тикетом (только для media requester)')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Регистрация slash команд...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('Slash команды успешно зарегистрированы!');
  } catch (error) {
    console.error('Ошибка при регистрации команд:', error);
  }
})();
