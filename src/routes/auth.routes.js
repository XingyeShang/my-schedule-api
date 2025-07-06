// src/routes/auth.routes.js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], authController.register);

router.post('/login', authLimiter, authController.login);

module.exports = router;
