// 阅读宝中转客户端（协议 V2.6）— Node 移植版
// 加密：随机会话密钥 + 时间戳 XOR + MD5 重排 KDF + RSA 封装
// 节点用 IP 直连，证书不匹配，进程内关闭校验（等价 Python verify=False）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const crypto = require('crypto');
const NodeRSA = null; // 用原生 crypto，避免额外依赖

const NODES = [
  "https://8.134.191.126",
  "https://8.148.243.26",
  "https://8.163.9.10",
];
const BASE = NODES[0];

const APP_ID = "yuedu&1bai322";
const TAIL = "y*y%h#132297";
const VERSION = "3.26.100313";
const DEFAULT_ANDROID_ID = "e5ffb1bdd015fbfa";

const RSA_PUB_SPKI = (
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCOTz9KHYYoG+hBG7R2lN98CDxW4D9WCT60hYxe" +
  "TxvGrBGZzLL2euNj9pIaY27/+6WX1a7yGrDad6fUm1hgyt6unlV+p7axneBbaesvqAUnaVQqcot2+" +
  "P5SQgKJsP7QZjZYhVPRsQgkeaCbb1OYfMc3RO8L4AHqTUK3LmTwUB7fCQIDAQAB"
);
const IDX = [0, 7, 26, 21, 31, 14, 25, 22, 11, 16, 21, 28, 23, 21, 19, 17];

// RSA 公钥（DER → PEM）
const RSA_PUB_PEM = "-----BEGIN PUBLIC KEY-----\n" +
  RSA_PUB_SPKI.replace(/(.{64})/g, "$1\n") + "\n-----END PUBLIC KEY-----";

function deriveKey(tsSec, nonce, androidId) {
  const plain = Buffer.from(APP_ID + tsSec + androidId + VERSION + nonce + TAIL, 'utf8');
  const tsBuf = Buffer.from(String(tsSec), 'utf8');
  const x = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i++) {
    x[i] = plain[i] ^ tsBuf[i % tsBuf.length];
  }
  const md5hex = crypto.createHash('md5').update(x).digest('hex');
  return Array.from(IDX).map(i => md5hex[i]).join('');
}

function aesEncrypt(key, text) {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null);
  cipher.setAutoPadding(true); // PKCS5/7
  const ct = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]);
  return ct.toString('base64') + "\n";
}

function rsaEncrypt(nonce) {
  const pub = crypto.createPublicKey(RSA_PUB_PEM);
  // PKCS1 v1.5 加密
  const enc = crypto.publicEncrypt(
    { key: pub, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(nonce, 'utf8')
  );
  return enc.toString('base64');
}

function encodeQuery(data) {
  return Object.entries(data)
    .filter(([k, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function requestOne(base, path, { params = {}, body = null, method = 'GET', token = '', androidId = DEFAULT_ANDROID_ID } = {}) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 16; i++) nonce += chars[Math.floor(Math.random() * chars.length)];
  const tsMs = Date.now();
  const ts = Math.floor(tsMs / 1000);
  const key = deriveKey(ts, nonce, androidId);

  const headers = {
    "appToken": token,
    "androidId": androidId,
    "version": VERSION,
    "X-Client": "android",
    "encryptType": "V2.6",
    "encryptKey": rsaEncrypt(nonce),
    "nonce": nonce,
    "timestamp": String(ts),
    "User-Agent": `(Linux; Android 11; MI 9) ${VERSION}`,
  };

  const q = { ...params, t: String(tsMs) };
  const rd = Object.entries(q).map(([k, v]) => `${k}=${v}`).join('&');
  const url = `${base}${path}?requestData=${encodeURIComponent(aesEncrypt(key, rd))}`;

  let respText;
  const fetchOpts = { method };
  if (method === 'POST') {
    headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8";
    fetchOpts.body = aesEncrypt(key, body || "");
  }
  // 节点用 IP 直连，证书不匹配。用环境变量 NODE_TLS_REJECT_UNAUTHORIZED=0 全局忽略
  // （在启动命令里设置，见 start 脚本）
  try {
    const res = await fetch(url, { ...fetchOpts, headers });
    respText = await res.text();
    if (res.status >= 500) throw new Error(`节点 ${base} 返回 ${res.status}`);
  } catch (e) {
    throw new Error(`节点 ${base} 连接失败: ${e.message}`);
  }

  let data;
  try {
    data = JSON.parse(respText);
  } catch (e) {
    throw new Error(`响应非 JSON: ${respText.slice(0, 120)}`);
  }
  if (String(data.code) !== '0' && String(data.code) !== '200') {
    throw new Error(data.msg || `错误码 ${data.code}`);
  }
  return data.data || {};
}

async function login(username, password, androidId = DEFAULT_ANDROID_ID, base = BASE) {
  const body = `user_name=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const d = await requestOne(base, "/api/user/login", { body, method: 'POST', token: '', androidId });
  return { token: d.token || '', user: d.user || {}, msg: d.msg || '' };
}

async function me(token, androidId = DEFAULT_ANDROID_ID, base = BASE) {
  return requestOne(base, "/api/user", { token, androidId });
}

module.exports = { NODES, BASE, login, me, requestOne, DEFAULT_ANDROID_ID };
