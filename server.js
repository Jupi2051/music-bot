// Este archivo configura un servidor web simple para mantener el bot activo en Replit
const express = require('express');
const server = express();
const port = process.env.PORT || 3000;

server.all('/', (req, res) => {
  res.send(`<h1>GordoDJ - Bot de Música</h1>
            <p>🎵 Bot activo y funcionando</p>
            <p>Tiempo de actividad: ${Math.floor(process.uptime())} segundos</p>`);
});

function keepAlive() {
  server.listen(port, () => {
    console.log(`📡 Servidor web iniciado en puerto ${port}`);
  });
}

module.exports = keepAlive;
