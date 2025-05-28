require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ]
});

// Eventos básicos del bot
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} está conectado`);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const channel = newState.channel || oldState.channel;
  if (!channel || channel.members.has(client.user.id)) return;

  if (channel.members.size === 4) {
    channel.join()
      .then(connection => {
        console.log(`🔊 Unido a ${channel.name}`);
        // Opcional: Reproducir audio
        connection.play('notification.mp3').on('finish', () => {
          connection.disconnect();
        });
      })
      .catch(console.error);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);