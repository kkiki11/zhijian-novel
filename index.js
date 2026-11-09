const express = require("express");
const path = require("path");
const app = express();

const PORT = Number(process.env.APP_PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

// 小说站静态文件目录
const novelDir = path.join(__dirname, "public", "novel");

// 根路径直接进入书架页
app.get("/", (req, res) => {
  res.sendFile(path.join(novelDir, "shelf.html"));
});

// 静态文件服务（禁用缓存）
app.use("/novel", express.static(novelDir, {
  extensions: ["html"],
  etag: false,
  lastModified: false,
  setHeaders: (res) => { res.setHeader("Cache-Control", "no-store"); },
}));

// API 端点
app.get("/api", (req, res) => res.json({ ok: true, message: "Hello from Express!" }));
app.get("/api/health", (req, res) => res.json({ ok: true, database: process.env.DATABASE_URL ? "configured" : "none" }));
app.get("/health", (req, res) => res.status(200).send("OK"));

// 登录页路由
app.get("/login", (req, res) => {
  res.sendFile(path.join(novelDir, "login.html"));
});

app.listen(PORT, HOST, () => console.log(`Express on ${HOST}:${PORT}`));
