const { getVoiceConnection } = require('@discordjs/voice');
// Importaciones necesarias al inicio
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Variable para evitar múltiples activaciones
const recentlyProcessed = new Set();

// Eventos básicos del bot
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} está conectado y listo!`);
  console.log(`🔢 Conectado a ${client.guilds.cache.size} servidor(es)`);
  
  // Verificar si el archivo de audio existe
  const audioPath = path.join(__dirname, 'notification.mp3');
  if (fs.existsSync(audioPath)) {
    console.log('🎵 Archivo de audio encontrado: notification.mp3');
  } else {
    console.warn('⚠️ Archivo notification.mp3 no encontrado en la carpeta del proyecto');
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const channel = newState.channel || oldState.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) return;

    // Verificar si el bot está en este canal
    const isBotInChannel = channel.members.has(client.user.id);

    // Caso 1: Si el bot está solo en el canal, desconectarse
    if (isBotInChannel && channel.members.size === 1) {
      const connection = getVoiceConnection(channel.guild.id);
      if (connection) {
        connection.destroy();
        console.log(`🔇 Desconectado de ${channel.name} (canal vacío)`);
      }
      return;
    }

    // Caso 2: Lógica original para unirse cuando hay 4 usuarios
    const members = channel.members.filter(m => !m.user.bot).size;
    console.log(`👥 ${channel.name} tiene ${members} miembros`);

    if (members === 4 && !isBotInChannel) {
      const channelKey = `${channel.id}-${Date.now()}`;
      const existingKey = Array.from(recentlyProcessed).find(key => 
        key.startsWith(channel.id) && 
        (Date.now() - parseInt(key.split('-')[1])) < 5000
      );
      
      if (existingKey) {
        console.log('⏭️ Canal ya procesado recientemente, omitiendo...');
        return;
      }
      
      recentlyProcessed.add(channelKey);
      setTimeout(() => recentlyProcessed.delete(channelKey), 10000);

      try {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });
        
        console.log(`🔊 Conectado a ${channel.name} (4 usuarios detectados)`);
        
        // Configurar el verificador de estado del canal
        const checkChannelState = () => {
          const currentChannel = client.channels.cache.get(channel.id);
          if (currentChannel && currentChannel.members.size === 1) {
            connection.destroy();
            console.log('🔇 Desconectado (solo el bot en el canal)');
          }
        };

        // Verificar periódicamente
        const checkInterval = setInterval(checkChannelState, 3000);
        
        connection.on(VoiceConnectionStatus.Ready, () => {
          console.log('🎵 Conexión de voz lista, reproduciendo audio...');
          playNotificationSound(connection);
        });
        
        if (connection.state.status === VoiceConnectionStatus.Ready) {
          playNotificationSound(connection);
        }
        
        connection.on('error', (error) => {
          console.error('❌ Error en la conexión de voz:', error);
          clearInterval(checkInterval);
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
          clearInterval(checkInterval);
        });
        
        // Desconexión después de 10 segundos (opcional)
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
            clearInterval(checkInterval);
            console.log('🔇 Desconectado por tiempo de inactividad');
          }
        }, 10000);
        
      } catch (error) {
        console.error('❌ Error al unirse al canal de voz:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error en voiceStateUpdate:', error);
  }
});

// Función para reproducir el sonido de notificación
function playNotificationSound(connection) {
  try {
    const audioPath = path.join(__dirname, 'notification.mp3');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(audioPath)) {
      console.error('❌ Archivo notification.mp3 no encontrado');
      return;
    }
    
    // Crear el reproductor de audio
    const player = createAudioPlayer();
    const resource = createAudioResource(audioPath, {
      inlineVolume: true
    });
    
    // Ajustar volumen (opcional, 0.1 = 10%)
    resource.volume.setVolume(0.5);
    
    // Reproducir el audio
    player.play(resource);
    connection.subscribe(player);
    
    console.log('🎵 Reproduciendo notification.mp3...');
    
    // Event listeners del reproductor (solo una vez por reproductor)
    player.once(AudioPlayerStatus.Playing, () => {
      console.log('🎵 Audio reproduciéndose');
    });
    
    player.once(AudioPlayerStatus.Idle, () => {
      console.log('✅ Audio terminado');
    });
    
    player.once('error', (error) => {
      console.error('❌ Error reproduciendo audio:', error);
    });
    
  } catch (error) {
    console.error('❌ Error en playNotificationSound:', error);
  }
}

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!')
      .catch(error => console.error('❌ Error enviando mensaje:', error));
  }
  
  // Comando para probar el audio
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