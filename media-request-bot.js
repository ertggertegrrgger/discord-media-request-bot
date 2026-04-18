require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Хранилище активных тикетов
const activeTickets = new Map(); // userId -> ticketChannelId
const ticketCounter = new Map(); // guildId -> counter
const awaitingResponse = new Set(); // channelId - каналы ожидающие первый ответ

client.once('ready', async () => {
  console.log(`Бот запущен как ${client.user.tag}`);
  
  // Отправляем сообщение с кнопкой в канал заявок
  const channel = await client.channels.fetch(process.env.REQUEST_CHANNEL_ID);
  
  if (channel) {
    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('ᴨодᴀᴛь зᴀяʙᴋу')
          .setStyle(ButtonStyle.Primary)
      );

    // Проверяем есть ли уже сообщение
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(msg => msg.author.id === client.user.id && msg.components.length > 0);
    
    if (!botMessage) {
      await channel.send({
        content: '# ʙы ʍожᴇᴛᴇ ᴨодᴀᴛь зᴀяʙᴋу нᴀ ᴩоᴧь ᴍᴇᴅɪᴀ ᴨо ᴋноᴨᴋᴇ нижᴇ',
        files: [process.env.IMAGE_PATH || 'media-image.jpg'],
        components: [button]
      });
      console.log('Сообщение с кнопкой отправлено');
    } else {
      console.log('Сообщение с кнопкой уже существует');
    }
  }
});

// Обработка нажатия кнопки создания тикета
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Создание тикета
  if (interaction.customId === 'create_ticket') {
    // Проверка на активный тикет
    if (activeTickets.has(interaction.user.id)) {
      return interaction.reply({
        content: 'У вас уже есть активный тикет!',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const mediaRole = await guild.roles.fetch(process.env.MEDIA_ROLE_ID);
      
      // Получаем счетчик тикетов
      if (!ticketCounter.has(guild.id)) {
        ticketCounter.set(guild.id, 0);
      }
      const count = ticketCounter.get(guild.id) + 1;
      ticketCounter.set(guild.id, count);

      // Создаем канал тикета
      const ticketChannel = await guild.channels.create({
        name: `ᴍᴇᴅɪᴀ-ᴛɪᴄᴋᴇᴛ-${count}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: mediaRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });

      // Сохраняем активный тикет
      activeTickets.set(interaction.user.id, ticketChannel.id);
      awaitingResponse.add(ticketChannel.id);

      // Отправляем форму в тикет
      await ticketChannel.send({
        content: `${interaction.user}, пожалуйста заполните и отправьте форму подачи на ᴍᴇᴅɪᴀ:\n\n` +
          `1. Сколько вам лет\n` +
          `2. Насколько хорошо вы понимаете правила нашего сервера\n` +
          `3. Несете ли вы ответственность за публикацию ваших видео в наш канал media?\n` +
          `4. Ссылка на ваш youtube канал\n` +
          `5. Вы снимаете / ведете эфиры только на платформе youtube?\n` +
          `6. Число ваших подписчиков на время подачи тикета\n` +
          `7. Вы снимаете только funtime или другие сервера?`
      });

      await interaction.editReply({
        content: `Тикет создан: ${ticketChannel}`,
        ephemeral: true
      });

      console.log(`Тикет создан: ${ticketChannel.name} для ${interaction.user.tag}`);
    } catch (error) {
      console.error('Ошибка при создании тикета:', error);
      await interaction.editReply({
        content: 'Произошла ошибка при создании тикета',
        ephemeral: true
      });
    }
  }

  // Принять тикет
  if (interaction.customId === 'accept_ticket') {
    const channel = interaction.channel;
    const userId = Array.from(activeTickets.entries()).find(([uid, cid]) => cid === channel.id)?.[0];
    
    if (!userId) return;

    const user = await client.users.fetch(userId);
    
    // Убираем права на отправку сообщений у пользователя
    await channel.permissionOverwrites.edit(userId, {
      SendMessages: false
    });

    await channel.send(`${user}, Вы приняты в media`);

    // Кнопка удаления тикета
    const deleteButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('delete_ticket')
          .setLabel('Удалить тикет')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.update({ components: [deleteButton] });
  }

  // Отклонить тикет
  if (interaction.customId === 'reject_ticket') {
    const channel = interaction.channel;
    const userId = Array.from(activeTickets.entries()).find(([uid, cid]) => cid === channel.id)?.[0];
    
    if (!userId) return;

    const user = await client.users.fetch(userId);
    
    // Убираем права на отправку сообщений у пользователя
    await channel.permissionOverwrites.edit(userId, {
      SendMessages: false
    });

    await channel.send(`${user}, К сожалению вы не приняты в media`);

    // Кнопка удаления тикета
    const deleteButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('delete_ticket')
          .setLabel('Удалить тикет')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.update({ components: [deleteButton] });
  }

  // Удалить тикет
  if (interaction.customId === 'delete_ticket') {
    await interaction.reply('Тикет будет удален через 5 секунд...');
    
    const channel = interaction.channel;
    const userId = Array.from(activeTickets.entries()).find(([uid, cid]) => cid === channel.id)?.[0];
    
    if (userId) {
      activeTickets.delete(userId);
    }
    awaitingResponse.delete(channel.id);

    setTimeout(async () => {
      try {
        await channel.delete();
        console.log(`Тикет ${channel.name} удален`);
      } catch (error) {
        console.error('Ошибка при удалении канала:', error);
      }
    }, 5000);
  }
});

// Обработка сообщений в тикетах
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const channel = message.channel;
  
  // Проверяем это тикет и ожидает ли он первого ответа
  if (awaitingResponse.has(channel.id)) {
    awaitingResponse.delete(channel.id);
    
    const mediaRole = await message.guild.roles.fetch(process.env.MEDIA_ROLE_ID);
    
    await channel.send(
      `Ваше сообщение находится в обработке, информация передана ответственному за media, ${mediaRole}`
    );
  }
});

// Slash команда /ticket для media requester
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.commandName === 'ticket') {
    const member = interaction.member;
    const mediaRole = interaction.guild.roles.cache.get(process.env.MEDIA_ROLE_ID);
    
    if (!member.roles.cache.has(mediaRole.id)) {
      return interaction.reply({
        content: 'У вас нет прав для использования этой команды',
        ephemeral: true
      });
    }

    // Проверяем что это канал тикета
    const channelName = interaction.channel.name;
    if (!channelName.startsWith('ᴍᴇᴅɪᴀ-ᴛɪᴄᴋᴇᴛ-')) {
      return interaction.reply({
        content: 'Эта команда работает только в каналах тикетов',
        ephemeral: true
      });
    }

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('accept_ticket')
          .setLabel('Принять тикет')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('reject_ticket')
          .setLabel('Отклонить')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: 'Выберите действие:',
      components: [buttons]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
