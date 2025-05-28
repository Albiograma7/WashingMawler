require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
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
    // Verifica si el cambio ocurrió en un canal de voz
    const channel = newState.channel || oldState.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice || channel.members.has(client.user.id)) return;

    const members = channel.members.filter(m => !m.user.bot).size; // Excluye bots
    console.log(`👥 ${channel.name} tiene ${members} miembros`);

    if (members === 4) {
      // Crear clave única para evitar duplicados
      const channelKey = `${channel.id}-${Date.now()}`;
      
      // Verificar si ya procesamos este canal recientemente (últimos 5 segundos)
      const existingKey = Array.from(recentlyProcessed).find(key => 
        key.startsWith(channel.id) && 
        (Date.now() - parseInt(key.split('-')[1])) < 5000
      );
      
      if (existingKey) {
        console.log('⏭️ Canal ya procesado recientemente, omitiendo...');
        return;
      }
      
      // Agregar a la lista de procesados
      recentlyProcessed.add(channelKey);
      
      // Limpiar entradas antiguas
      setTimeout(() => {
        recentlyProcessed.delete(channelKey);
      }, 10000);

      try {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });
        
        console.log(`🔊 Conectado a ${channel.name} (4 usuarios detectados)`);
        
        // Esperar a que la conexión esté lista
        connection.on(VoiceConnectionStatus.Ready, () => {
          console.log('🎵 Conexión de voz lista, reproduciendo audio...');
          playNotificationSound(connection);
        });
        
        // Si ya está listo, reproducir inmediatamente
        if (connection.state.status === VoiceConnectionStatus.Ready) {
          playNotificationSound(connection);
        }
        
        // Manejo de errores de conexión
        connection.on('error', (error) => {
          console.error('❌ Error en la conexión de voz:', error);
        });
        
        // Desconectarse después de un tiempo (opcional)
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
            console.log('🔇 Desconectado del canal de voz');
          }
        }, 10000); // 10 segundos
        
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