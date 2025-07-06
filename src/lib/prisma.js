// src/lib/prisma.js
const { PrismaClient } = require('@prisma/client');

// 创建一个全局唯一的 Prisma Client 实例
const prisma = new PrismaClient();

// 将这个实例导出，以便其他文件可以共享使用
module.exports = prisma;
