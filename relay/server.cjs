'use strict';
const { WebSocketServer, WebSocket } = require('ws');
const port = Number(process.env.PORT || 8787);
const server = new WebSocketServer({ host: '127.0.0.1', port, maxPayload: 65536 });
server.on('connection', (client, request) => {
  const room = new URL(request.url, 'http://localhost').searchParams.get('room') || '';
  if (!room || room.length > 128) return client.close(1008, 'Room required (max 128 characters)');
  client.room = room;
  client.on('error', () => {});
  client.on('message', (bytes, binary) => {
    if (binary) return;
    let message;
    try { message = JSON.parse(bytes.toString()); } catch { return; }
    if (message.room !== client.room || !message.frame) return;
    const text = JSON.stringify({ room: client.room, frame: message.frame });
    for (const peer of server.clients) {
      if (peer !== client && peer.room === client.room && peer.readyState === WebSocket.OPEN && peer.bufferedAmount < 262144) peer.send(text);
    }
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
console.log(`SIGNAL relay listening on ws://127.0.0.1:${port} (local machine only)`);
