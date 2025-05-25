# Guía para Hospedar GordoDJ en Replit

Esta guía te mostrará cómo hospedar tu bot de música para Discord en Replit de forma gratuita.

## Paso 1: Crear una cuenta en Replit

Si aún no tienes una cuenta, regístrate en [Replit](https://replit.com).

## Paso 2: Crear un nuevo Repl

1. Haz clic en "+ Create Repl"
2. Selecciona "Import from GitHub"
3. Pega la URL de tu repositorio
4. Selecciona "Node.js" como lenguaje
5. Haz clic en "Import from GitHub"

## Paso 3: Configurar las variables de entorno (Secrets)

1. En el panel izquierdo, haz clic en el icono de candado (Secrets)
2. Agrega las siguientes claves y valores:
   - `TOKEN`: Tu token de bot de Discord
   - `CLIENT_ID`: El ID de tu aplicación de Discord

## Paso 4: Ejecutar el bot

1. Haz clic en el botón "Run" en la parte superior
2. El bot debería iniciar correctamente y mostrar un mensaje de conexión

## Paso 5: Mantener el bot activo 24/7

Por defecto, Replit pondrá a dormir tu proyecto después de un período de inactividad. Para mantenerlo activo:

### Opción 1: Usar UptimeRobot (Recomendado)

1. Crea una cuenta en [UptimeRobot](https://uptimerobot.com)
2. Agrega un nuevo monitor de tipo HTTP(s)
3. Configura la URL como la URL de tu Repl (aparece en la ventana de vista previa web)
4. Establece un intervalo de verificación de 5 minutos
5. Guarda la configuración

### Opción 2: Agregar un servidor web simple

Agrega este código al final de tu archivo `index.js`:

```javascript
// Servidor web simple para mantener el repl activo
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('¡Bot de música activo!');
});

app.listen(port, () => {
  console.log(`Servidor web iniciado en el puerto ${port}`);
});
```

Y asegúrate de instalar Express:
```
npm install express
```

## Solución de problemas comunes

### El bot se desconecta frecuentemente
- Verifica que UptimeRobot esté correctamente configurado
- Asegúrate de que tu bot no exceda los límites de recursos de Replit

### Problemas con FFmpeg
- Si hay problemas con FFmpeg, prueba a usar `@discordjs/opus` en lugar de `opusscript`
- Verifica que el archivo `replit.nix` incluya FFmpeg como dependencia

### Comandos slash no funcionan
- Ejecuta manualmente `node deploy-commands.js` en la consola de Replit
- Verifica que las variables de entorno estén correctamente configuradas
