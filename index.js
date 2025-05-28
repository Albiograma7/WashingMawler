require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // Necesario para leer el contenido de los mensajes
  ]
});

// Eventos básicos del bot
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} está conectado y listo!`);
  console.log(`🔢 Conectado a ${client.guilds.cache.size} servidor(es)`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // Verifica si el cambio ocurrió en un canal de voz
    const channel = newState.channel || oldState.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice || channel.members.has(client.user.id)) return;

    const members = channel.members.filter(m => !m.user.bot).size; // Excluye bots
    console.log(`👥 ${channel.name} tiene ${members} miembros`);

    if (members === 4) {
      try {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });
        
        console.log(`🔊 Conectado a ${channel.name} (4 usuarios detectados)`);
        
        // Manejo de errores de conexión
        connection.on('error', (error) => {
          console.error('❌ Error en la conexión de voz:', error);
        });
        
        // Opcional: Reproduce un audio
        // Necesitarías también el paquete @discordjs/voice para reproducir audio
        // connection.play(createAudioResource('notification.mp3'));
      } catch (error) {
        console.error('❌ Error al unirse al canal de voz:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error en voiceStateUpdate:', error);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!')
      .catch(error => console.error('❌ Error enviando mensaje:', error));
  }
});

// Manejo de errores importantes
client.on('error', (error) => {
  console.error('❌ Error del cliente Discord:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Advertencia:', warning);
});

// Manejo de errores de proceso
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Verificar token antes de intentar login
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN no encontrado en las variables de entorno');
  console.error('💡 Asegúrate de tener configurada la variable DISCORD_TOKEN en Railway');
  process.exit(1);
}

console.log('🚀 Iniciando bot...');
client.login(token)
  .then(() => {
    console.log('✅ Login exitoso');
  })
  .catch(error => {
    console.error('❌ Error en el login:', error);
    process.exit(1);
  });