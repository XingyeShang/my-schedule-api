// src/controllers/auth.controller.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, 8);
        const user = await prisma.user.create({ data: { email, password: hashedPassword } });
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ message: '用户创建成功', user: userWithoutPassword });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: '该邮箱已被注册' });
        }
        res.status(500).json({ error: '注册失败' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: '邮箱或密码错误' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: '登录成功', token });
};