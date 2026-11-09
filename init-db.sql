-- 纸间小说平台 数据库初始化
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS novels (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(100),
  description TEXT,
  cover_color VARCHAR(20) DEFAULT '#8B7E74',
  category VARCHAR(50) DEFAULT '其他',
  status VARCHAR(20) DEFAULT 'ongoing',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_books (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  last_read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, novel_id)
);
