const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');
const ydb = require('./yuedubao');

const app = express();
const PORT = Number(process.env.APP_PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// 数据库连接
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'bjd1suus-postgresql-17',
  port: 5432,
  database: 'appdb',
  user: 'appuser',
  password: process.env.POSTGRES_PASSWORD || 'IBS80GFpGPHL2adFCnoYbXqN',
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'zhijian-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

// 静态文件
const novelDir = path.join(__dirname, 'public', 'novel');
app.use('/novel', express.static(novelDir, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); },
}));

// ===== 认证中间件 =====
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, message: '请先登录' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, message: '请先登录' });
  if (!req.session.isAdmin) return res.status(403).json({ ok: false, message: '需要管理员权限' });
  next();
}

// ===== 登录（走阅读宝接口）=====
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, message: '请输入账号和密码' });

  try {
    const r = await ydb.login(username, password);
    if (!r.token) return res.status(401).json({ ok: false, message: r.msg || '账号或密码错误' });

    // 登录态存 session
    req.session.ydb_token = r.token;
    req.session.ydb_user = r.user;
    req.session.userId = r.user.id || username;
    req.session.isAdmin = true; // 登录用户即可进后台（个人使用）

    // 顺便落库（记录登录过的用户，可选）
    try {
      await pool.query(
        `INSERT INTO users (username, email, password_hash) VALUES ($1,$2,$3)
         ON CONFLICT (username) DO UPDATE SET email=EXCLUDED.email`,
        [username, (r.user.email || r.user.phone || null), 'ydb-token-login']
      );
    } catch (e) { /* 落库失败不阻塞登录 */ }

    res.json({ ok: true, user: { id: r.user.id || username, username: username, isAdmin: true } });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(401).json({ ok: false, message: '登录失败: ' + err.message });
  }
});

// ===== 登出 =====
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== 当前用户 =====
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: true, user: null });
  try {
    const result = await pool.query('SELECT id, username, email, is_admin, created_at FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.json({ ok: true, user: null });
    const u = result.rows[0];
    res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email, isAdmin: u.is_admin, createdAt: u.created_at } });
  } catch (err) {
    res.json({ ok: true, user: { id: req.session.userId, isAdmin: req.session.isAdmin } });
  }
});

// ===== 小说列表（公开）=====
app.get('/api/novels', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM novels ORDER BY created_at DESC');
    res.json({ ok: true, novels: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: '获取失败' });
  }
});

// ===== 添加小说（管理员）=====
app.post('/api/novels', requireAdmin, async (req, res) => {
  const { title, author, description, cover_color, category, status } = req.body;
  if (!title) return res.status(400).json({ ok: false, message: '书名必填' });
  try {
    const result = await pool.query(
      'INSERT INTO novels (title, author, description, cover_color, category, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, author, description, cover_color || '#8B7E74', category || '其他', status || 'ongoing']
    );
    res.json({ ok: true, novel: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: '添加失败' });
  }
});

// ===== 删除小说（管理员）=====
app.delete('/api/novels/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM novels WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: '删除失败' });
  }
});

// ===== 页面路由 =====
app.get('/', (req, res) => res.sendFile(path.join(novelDir, 'shelf.html')));
app.get('/login', (req, res) => res.sendFile(path.join(novelDir, 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(novelDir, 'admin.html')));
app.get('/me', (req, res) => res.sendFile(path.join(novelDir, 'me.html')));

// 健康检查
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.json({ ok: true, database: 'configured' }));

app.listen(PORT, HOST, () => console.log(`✓ 纸间服务运行在 ${HOST}:${PORT}`));
