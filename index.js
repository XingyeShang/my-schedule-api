// =================================================================
//                 智能日程API - 阶段四最终完整版
//           (在阶段三基础上，新增后台定时提醒功能)
// =================================================================

// ---------------------------------
// 1. 引入所有需要的库 (Dependencies)
// ---------------------------------
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express'); 
const { body, validationResult } = require('express-validator');
const cron = require('node-cron'); // <-- 新增：引入任务调度库
const cors = require('cors');
// ---------------------------------
// 2. 初始化与核心配置 (Initialization & Config)
// ---------------------------------
const prisma = new PrismaClient();
const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-super-secret-and-long-key-that-no-one-can-guess';

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
  servers: [{ url: `http://localhost:${PORT}` }],
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
          reminderTime: { type: 'string', format: 'date-time' },
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
app.use(express.json());
app.use(cors()); // 允许所有来源的跨域请求
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); 

// ---------------------------------
// 5. 认证中间件 (Authentication Middleware)
// ---------------------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) return res.sendStatus(403);
    req.user = userPayload;
    next();
  });
};

// ---------------------------------
// 6. 认证 API 路由 (Auth Routes)
// ---------------------------------
app.post('/auth/register', [
    body('email', '请输入有效的邮箱地址').isEmail().normalizeEmail(),
    body('password', '密码长度不能小于6位').isLength({ min: 6 }),
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 8);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword },
      });
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ message: '用户创建成功', user: userWithoutPassword });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }
      res.status(500).json({ error: '注册失败' });
    }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ message: '登录成功', token });
});

// ---------------------------------
// 7. 日程 API 路由 (Event Routes)
// ---------------------------------
app.post('/events', authenticateToken, [
    body('title', '标题不能为空').not().isEmpty().trim().escape(),
    body('startTime', '必须是有效的日期格式').isISO8601().toDate(),
    body('endTime', '必须是有效的日期格式').isISO8601().toDate(),
    body('reminderTime').optional().isISO8601().toDate(),
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { title, description, startTime, endTime, reminderTime } = req.body;
    const userId = req.user.userId;
    
    const newEvent = await prisma.event.create({
      data: {
        title,
        description,
        startTime,
        endTime,
        userId,
        reminderTime: reminderTime || null,
      },
    });
    res.status(201).json(newEvent);
});

app.get('/events', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const events = await prisma.event.findMany({
    where: { userId: userId },
    orderBy: { startTime: 'asc' },
  });
  res.json(events);
});

app.put('/events/:id', authenticateToken, [
    body('title').optional().not().isEmpty().trim().escape(),
    body('description').optional().trim().escape(),
    body('startTime').optional().isISO8601().toDate(),
    body('endTime').optional().isISO8601().toDate(),
    body('reminderTime').optional({ nullable: true }).isISO8601().toDate(),
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const eventId = parseInt(req.params.id);
    const dataToUpdate = req.body;
    
    try {
        const event = await prisma.event.findFirst({
            where: { id: eventId, userId: userId }
        });
        if (!event) {
            return res.status(404).json({ error: '日程未找到或您没有权限' });
        }
        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: dataToUpdate,
        });
        res.json(updatedEvent);
    } catch(error) {
        console.error("Update event error:", error);
        res.status(500).json({ error: '更新失败' });
    }
});

app.delete('/events/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.id);
    try {
        const event = await prisma.event.findFirst({
            where: { id: eventId, userId: userId }
        });
        if (!event) {
            return res.status(404).json({ error: '日程未找到或您没有权限' });
        }
        await prisma.event.delete({
            where: { id: eventId },
        });
        res.status(204).send();
    } catch(error) {
        res.status(500).json({ error: '删除失败' });
    }
});

// ---------------------------------
// 8. 后台定时任务 (Cron Job)
// ---------------------------------
console.log('⏰ 定时提醒任务已设置，每分钟将进行一次检查...');

cron.schedule('* * * * *', async () => {
  const checkTime = new Date();
  console.log(`\n[${checkTime.toLocaleTimeString()}] Running a check for reminders...`);
  
  try {
    const eventsToRemind = await prisma.event.findMany({
      where: {
        isReminderSent: false,
        reminderTime: {
          not: null,
          lte: checkTime,
        },
      },
      include: { user: true }
    });

    if (eventsToRemind.length === 0) {
      console.log('No reminders to send at this time.');
      return;
    }

    console.log(`[+] Found ${eventsToRemind.length} event(s) to send reminders for.`);

    for (const event of eventsToRemind) {
      console.log(`
        ==================================================
        🚀 SENDING REMINDER!
        --------------------------------------------------
        TO:         ${event.user.email}
        EVENT:      "${event.title}"
        START TIME: ${event.startTime.toLocaleString()}
        REMINDER:   ${event.reminderTime.toLocaleString()}
        ==================================================
      `);
    }

    const idsToUpdate = eventsToRemind.map(event => event.id);
    await prisma.event.updateMany({
      where: {
        id: { in: idsToUpdate },
      },
      data: {
        isReminderSent: true,
      },
    });
    console.log(`[✔] Successfully marked ${idsToUpdate.length} event(s) as sent.`);
    
  } catch (error) {
    console.error('Error during reminder check task:', error);
  }
});

// ---------------------------------
// 9. 启动服务器 (Start Server)
// ---------------------------------
app.listen(PORT, () => {
  console.log(`🎉 阶段四服务器已就绪，API文档请访问 http://localhost:${PORT}/api-docs`);
});