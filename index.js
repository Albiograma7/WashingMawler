const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

// Configuración del cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Objeto para rastrear canales procesados
const processedChannels = new Set();

// Evento cuando el bot está listo
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} está conectado y listo!`);
  console.log(`🔢 Conectado a ${client.guilds.cache.size} servidor(es)`);

  // Verificar archivo de audio
  const audioPath = path.join(__dirname, 'notification.mp3');
  if (fs.existsSync(audioPath)) {
    console.log('🎵 Archivo de audio encontrado: notification.mp3');
  } else {
    console.warn('⚠️ Archivo notification.mp3 no encontrado en la carpeta del proyecto');
  }
});

// Manejo de actualizaciones de estado de voz
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const channel = newState.channel || oldState.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) return;

    const isBotInChannel = channel.members.has(client.user.id);
    const members = channel.members.filter(m => !m.user.bot).size;

    // Caso 1: Bot solo en el canal - desconectar
    if (isBotInChannel && channel.members.size === 1) {
      const connection = getVoiceConnection(channel.guild.id);
      if (connection) {
        connection.destroy();
        processedChannels.delete(channel.id);
        console.log(`🔇 Desconectado de ${channel.name} (canal vacío)`);
      }
      return;
    }

    // Caso 2: 4 usuarios detectados - unirse y reproducir audio (solo una vez)
    if (members === 4 && !isBotInChannel && !processedChannels.has(channel.id)) {
      processedChannels.add(channel.id);

      try {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        console.log(`🔊 Conectado a ${channel.name} (4 usuarios detectados)`);

        // Configurar verificación periódica del estado del canal
        const checkChannelState = () => {
          const currentChannel = client.channels.cache.get(channel.id);
          if (currentChannel && currentChannel.members.size === 1) {
            connection.destroy();
            processedChannels.delete(channel.id);
            console.log('🔇 Desconectado (solo el bot en el canal)');
          }
        };

        const checkInterval = setInterval(checkChannelState, 3000);

        // Manejo de eventos de conexión
        connection.on(VoiceConnectionStatus.Ready, () => {
          console.log('🎵 Conexión de voz lista, reproduciendo audio...');
          playNotificationSound(connection, () => {
            console.log('✅ Audio terminado, el bot permanecerá en el canal');
          });
        });

        connection.on('error', (error) => {
          console.error('❌ Error en la conexión de voz:', error);
          clearInterval(checkInterval);
          processedChannels.delete(channel.id);
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
          clearInterval(checkInterval);
          processedChannels.delete(channel.id);
        });

      } catch (error) {
        console.error('❌ Error al unirse al canal de voz:', error);
        processedChannels.delete(channel.id);
      }
    }
  } catch (error) {
    console.error('❌ Error en voiceStateUpdate:', error);
  }
});

// Función para reproducir el sonido de notificación
function playNotificationSound(connection, callback) {
  try {
    const audioPath = path.join(__dirname, 'notification.mp3');
    
    if (!fs.existsSync(audioPath)) {
      console.error('❌ Archivo notification.mp3 no encontrado');
      return callback?.();
    }
    
    const player = createAudioPlayer();
    const resource = createAudioResource(audioPath, {
      inlineVolume: true
    });
    
    resource.volume.setVolume(0.5);
    player.play(resource);
    connection.subscribe(player);
    
    console.log('🎵 Reproduciendo notification.mp3...');
    
    player.once(AudioPlayerStatus.Idle, () => {
      console.log('✅ Audio terminado');
      callback?.();
    });
    
    player.once('error', (error) => {
      console.error('❌ Error reproduciendo audio:', error);
      callback?.();
    });
    
  } catch (error) {
    console.error('❌ Error en playNotificationSound:', error);
    callback?.();
  }
}

// Comandos de texto para pruebas
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!')
      .catch(error => console.error('❌ Error enviando mensaje:', error));
  }
  
  if (message.content === '!test-audio') {
    if (message.member.voice.channel) {
      const connection = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });
      
      connection.on(VoiceConnectionStatus.Ready, () => {
        playNotificationSound(connection);
        message.reply('🎵 Probando audio...');
      });
    } else {
      message.reply('❌ Debes estar en un canal de voz para probar el audio');
    }
  }
});

// Manejo de errores
client.on('error', (error) => {
  console.error('❌ Error del cliente Discord:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Advertencia:', warning);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar el bot
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN no encontrado en las variables de entorno');
  console.error('💡 Asegúrate de tener configurada la variable DISCORD_TOKEN');
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