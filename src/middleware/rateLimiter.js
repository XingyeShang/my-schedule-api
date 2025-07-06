// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 分钟
	max: 100, // 每个IP在15分钟内最多100次请求
	standardHeaders: true,
	legacyHeaders: false,
    message: { error: '请求过于频繁，请在15分钟后重试！' },
});

module.exports = { authLimiter };
