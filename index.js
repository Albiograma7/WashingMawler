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
  try {
    // Verifica si el cambio ocurrió en un canal de voz
    const channel = newState.channel || oldState.channel;
    if (!channel || channel.type !== 2 || channel.members.has(client.user.id)) return; // type 2 = GUILD_VOICE

    const members = channel.members.filter(m => !m.user.bot).size; // Excluye bots

    if (members === 4) {
      channel.join()
        .then(connection => {
          console.log(`🔊 Conectado a ${channel.name}`);
          // Opcional: Reproduce un audio
          connection.play('notification.mp3').on('finish', () => {
            connection.disconnect();
          });
        })
        .catch(error => {
          console.error('Error al unirse:', error);
        });
    }
  } catch (error) {
    console.error('Error en voiceStateUpdate:', error);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);