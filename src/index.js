// =================================================================
//                 智能日程API - 阶段四最终完整版
//           (在阶段三基础上，新增后台定时提醒功能)
// =================================================================

// ---------------------------------
// 1. 引入所有需要的库 (Dependencies)
// ---------------------------------
// my-schedule-api/index.js

// my-schedule-api/index.js

// src/index.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { subMinutes, subHours, subDays } = require('date-fns');
const { sendReminderEmail } = require('./mailService.js');

// 导入我们的路由模块
const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const eventRoutes = require('./routes/event.routes');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
// ---------------------------------
// 3. Swagger API 规范对象 (Swagger Spec Object)
// ---------------------------------
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: '智能日程与任务管理 API',
    version: '1.0.0',
    description: '一个使用 Express, Prisma 和 JWT 构建的功能丰富的日程管理后端服务。',
  },
  servers: [{ url: `http://localhost:3000` }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', example: '团队周会' },
          description: { type: 'string', example: '讨论项目进展' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          recurrence: { type: 'string', example: 'weekly' },
          reminderValue: { type: 'integer', example: 10 },
          reminderUnit: { type: 'string', example: 'minutes' },
          isReminderSent: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          userId: { type: 'integer', example: 1 },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: '注册一个新用户',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'test@example.com' },
                  password: { type: 'string', format: 'password', description: '密码长度至少6位', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '用户创建成功' },
          '400': { description: '错误的请求' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: '用户登录',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'test@example.com' },
                  password: { type: 'string', format: 'password', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '登录成功，返回认证Token。',
            content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } },
          },
          '401': { description: '认证失败' },
        },
      },
    },
    '/events': {
      post: {
        summary: '创建一个新的日程',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: '参加团队会议' },
                  description: { type: 'string', example: '讨论下一季度规划' },
                  startTime: { type: 'string', format: 'date-time', example: '2025-06-20T14:00:00Z' },
                  endTime: { type: 'string', format: 'date-time', example: '2025-06-20T15:00:00Z' },
                  reminderTime: { type: 'string', format: 'date-time', example: '2025-06-20T13:55:00Z' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '日程创建成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
          '400': { description: '错误的请求' },
          '401': { description: '未授权' },
        },
      },
      get: {
        summary: '获取当前用户的所有日程',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '成功获取日程列表',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } },
          },
          '401': { description: '未授权' },
        },
      },
    },
    '/events/{id}': {
      put: {
        summary: '更新一个指定的日程',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  reminderTime: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '日程更新成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
          '404': { description: '日程未找到或无权限' },
          '401': { description: '未授权' },
        },
      },
      delete: {
        summary: '删除一个指定的日程',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          '204': { description: '日程删除成功' },
          '404': { description: '日程未找到或无权限' },
          '401': { description: '未授权' },
        },
      },
    },
  },
};

// ---------------------------------
// 4. 全局中间件 (Global Middleware)
// ---------------------------------
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); 

// --- 路由 ---
// 为不同的模块指定一个基础路径
app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/events', eventRoutes);

// --- 错误处理中间件 (可选，但推荐) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// --- CRON JOB ---
cron.schedule('* * * * *', async () => {
  const now = new Date();
  try {
    const eventsToRemind = await prisma.event.findMany({
      where: {
        isReminderSent: false,
        reminderValue: { not: null },
        reminderUnit: { not: null },
      },
      include: { user: true },
    });
    const eventsToSend = [];
    for (const event of eventsToRemind) {
      let reminderTime;
      const value = event.reminderValue;
      switch (event.reminderUnit) {
        case 'minutes': reminderTime = subMinutes(event.startTime, value); break;
        case 'hours': reminderTime = subHours(event.startTime, value); break;
        case 'days': reminderTime = subDays(event.startTime, value); break;
        default: continue;
      }
      if (now >= reminderTime) {
        eventsToSend.push(event);
      }
    }
    if (eventsToSend.length > 0) {
      for (const event of eventsToSend) {
        await sendReminderEmail(event.user.email, event);
      }
      const idsToUpdate = eventsToSend.map(e => e.id);
      await prisma.event.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { isReminderSent: true },
      });
    }
  } catch (error) {
    console.error('Error during reminder check task:', error);
  }
});


app.listen(PORT, () => {
  console.log(`🎉 后端服务器已启动，运行在 http://localhost:${PORT}`);
});

