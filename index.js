const express = require('express');
const path = require('path');
const app = express();

// APP_PORT is the platform's convention: every framework listens on it and the
// container's own nginx fronts it on 80, which is how a sibling tier reaches
// this service (SERVICE_<NAME>_URL points at http://<service>:80).
const PORT = Number(process.env.APP_PORT || 8000);

// Serve static files from /public/novel (纸间 mobile UI)
app.use('/novel', express.static(path.join(__dirname, 'public', 'novel'), {
  extensions: ['html'],
  maxAge: '1h',
}));

// Answered on BOTH / and /api.
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.get('/api', (req, res) => {
  res.json({ ok: true, message: 'Hello from Express!' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: process.env.DATABASE_URL ? 'configured' : 'none' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Express server running on port ${PORT}`);
});
