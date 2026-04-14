const { WebSocket } = require('ws');
const ws = new WebSocket('ws://localhost:3000/api/agents/ef00de47-7fd2-0da5-8ddd-b046d1de230d/ws');
ws.on('open', () => {
    console.log('Connected!');
    ws.send(JSON.stringify({ type: 'message', content: { text: "hello" }, roomId: "room123", userId: "user123" }));
});
ws.on('message', (data) => console.log('Received:', data.toString()));
ws.on('error', (err) => console.error('Error:', err));
ws.on('close', () => console.log('Closed'));
setTimeout(() => { ws.close(); process.exit(0); }, 5000);
