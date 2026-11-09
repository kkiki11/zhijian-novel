const express = require('express');
const path = require('path');
const app = express();

// APP_PORT is the platform's convention: every framework listens on it and the
// container's own nginx fronts it on 80.
const PORT = Number(process.env.APP_PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// Serve static files from /public/novel (纸间 mobile UI)
app.use('/novel', express.static(path.join(__dirname, 'public', 'novel'), {
  extensions: ['html'],
  maxAge: '1h',
}));

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.get('/api', (req, res) => {
  res.json({ ok: true, message: 'Hello from Express!' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: process.env.DATABASE_URL ? 'configured' : 'none' });
});

// Graceful startup with error logging
const server = app.listen(PORT, HOST, () => {
  console.log(`Express server running on ${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Handle uncaught errors so the process doesn't die silently
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
