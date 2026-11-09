const express = require('express');
const path = require('path');
const app = express();

// 启动时打印环境信息
console.log('=== 启动诊断 ===');
console.log('Node version:', process.version);
console.log('APP_PORT:', process.env.APP_PORT);
console.log('PORT:', process.env.PORT);
console.log('HOST:', process.env.HOST);
console.log('Current dir:', process.cwd());
console.log('__dirname:', __dirname);

// 平台约定：APP_PORT 或 PORT，默认 8000
const PORT = Number(process.env.APP_PORT || process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// 静态文件服务
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

// 健康检查端点（平台可能用这个）
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 启动服务器
const server = app.listen(PORT, HOST, () => {
  console.log(`✓ Express running on ${HOST}:${PORT}`);
  console.log('=== 就绪 ===');
});

server.on('error', (err) => {
  console.error('✗ Server error:', err.code, err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('✗ Uncaught:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('✗ Rejection:', err);
});
