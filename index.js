// =================================================================
//                 智能日程API - 阶段四最终完整版
//           (在阶段三基础上，新增后台定时提醒功能)
// =================================================================

// ---------------------------------
// 1. 引入所有需要的库 (Dependencies)
// ---------------------------------
// my-schedule-api/index.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const cron = require('node-cron');
const { addDays, addWeeks, addMonths, isWithinInterval, subMinutes, subHours, subDays } = require('date-fns');
const { sendReminderEmail } = require('./mailService.js'); // 1. 引入邮件服务

const prisma = new PrismaClient();
const app = express();
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
// --- AUTH ROUTES ---
app.post('/auth/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
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
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: '邮箱或密码错误' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: '登录成功', token });
});

// --- 【新增】CATEGORY ROUTES ---
// --- CATEGORY ROUTES ---
app.get('/categories', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const categories = await prisma.category.findMany({
      where: { userId: userId },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: '获取分类失败' });
  }
});

app.post('/categories', authenticateToken, [
  body('name').notEmpty().withMessage('分类名称不能为空'),
  body('color').isHexColor().withMessage('必须提供有效的十六进制颜色值'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, color } = req.body;
  const userId = req.user.userId;

  try {
    const newCategory = await prisma.category.create({
      data: { name, color, userId },
    });
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该分类名称已存在' });
    }
    res.status(500).json({ error: '创建分类失败' });
  }
});

app.put('/categories/:id', authenticateToken, [
  body('name').notEmpty().withMessage('分类名称不能为空'),
  body('color').isHexColor().withMessage('必须提供有效的十六进制颜色值'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const categoryId = parseInt(req.params.id);
  const { name, color } = req.body;
  const userId = req.user.userId;

  try {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: userId }
    });
    if (!category) {
      return res.status(404).json({ error: '分类未找到或无权限' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: { name, color },
    });
    res.json(updatedCategory);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该分类名称已存在' });
    }
    res.status(500).json({ error: '更新分类失败' });
  }
});

// 【关键修复】新增删除分类的路由
app.delete('/categories/:id', authenticateToken, async (req, res) => {
  const categoryId = parseInt(req.params.id);
  const userId = req.user.userId;

  try {
    // 确保用户只能删除自己的分类
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: userId }
    });
    if (!category) {
      return res.status(404).json({ error: '分类未找到或无权限' });
    }

    // 直接删除分类，Prisma会根据schema中的onDelete: SetNull自动处理关联的Event
    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.status(204).send(); // 删除成功，无内容返回
  } catch (error) {
    console.error("删除分类时出错:", error);
    res.status(500).json({ error: '删除分类失败' });
  }
});

// --- EVENT ROUTES ---
app.get('/events', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(new Date().setDate(1));
    const endDate = end ? new Date(end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    try {
        const baseEvents = await prisma.event.findMany({ where: { userId } });
        const allEvents = [];
        baseEvents.forEach(event => {
            if (!event.recurrence) {
                if (isWithinInterval(event.startTime, { start: startDate, end: endDate })) {
                    allEvents.push(event);
                }
            } else {
                let currentDate = event.startTime;
                let currentEndDate = event.endTime;
                while (currentDate <= endDate) {
                    if (currentDate >= startDate) {
                        allEvents.push({
                            ...event,
                            recurrentEventId: `${event.id}-${currentDate.toISOString()}`,
                            startTime: currentDate,
                            endTime: currentEndDate,
                        });
                    }
                    switch (event.recurrence) {
                        case 'daily': currentDate = addDays(currentDate, 1); currentEndDate = addDays(currentEndDate, 1); break;
                        case 'weekly': currentDate = addWeeks(currentDate, 1); currentEndDate = addWeeks(currentEndDate, 1); break;
                        case 'monthly': currentDate = addMonths(currentDate, 1); currentEndDate = addMonths(currentEndDate, 1); break;
                        default: currentDate = new Date(endDate.getTime() + 1); break;
                    }
                }
            }
        });
        allEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        res.json(allEvents);
    } catch (error) {
        res.status(500).json({ error: "获取日程失败" });
    }
});

app.post('/events', authenticateToken, [
    body('title').notEmpty(),
    body('startTime').isISO8601(),
    body('endTime').isISO8601(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, startTime, endTime, recurrence, reminderValue, reminderUnit, categoryId } = req.body;
    try {
        const newEvent = await prisma.event.create({
            data: {
                title, description,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                recurrence: recurrence === 'none' ? null : recurrence,
                reminderValue: reminderUnit !== 'none' && reminderValue > 0 ? parseInt(reminderValue, 10) : null,
                reminderUnit: reminderUnit !== 'none' && reminderValue > 0 ? reminderUnit : null,
                // 【关键改动】将 categoryId 添加到要创建的数据中
                categoryId: categoryId ? parseInt(categoryId, 10) : null,
                userId: req.user.userId,
            },
        });
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(500).json({ error: '创建日程失败' });
    }
});

app.put('/events/:id', authenticateToken, async (req, res) => {
    const eventId = parseInt(req.params.id);
    const { title, description, startTime, endTime, recurrence, reminderValue, reminderUnit, categoryId } = req.body;
    try {
        const event = await prisma.event.findFirst({ where: { id: eventId, userId: req.user.userId } });
        if (!event) return res.status(404).json({ error: '日程未找到或无权限' });
        
        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: {
                title, description,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                recurrence: recurrence === 'none' ? null : recurrence,
                reminderValue: reminderUnit !== 'none' && reminderValue > 0 ? parseInt(reminderValue, 10) : null,
                reminderUnit: reminderUnit !== 'none' && reminderValue > 0 ? reminderUnit : null,
                // 【关键改动】将 categoryId 添加到要更新的数据中
                categoryId: categoryId ? parseInt(categoryId, 10) : null,
            },
        });
        res.json(updatedEvent);
    } catch (error) {
        res.status(500).json({ error: '更新日程失败' });
    }
});

app.delete('/events/:id', authenticateToken, async (req, res) => {
    const eventId = parseInt(req.params.id);
    try {
        const event = await prisma.event.findFirst({ where: { id: eventId, userId: req.user.userId } });
        if (!event) return res.status(404).json({ error: '日程未找到或无权限' });
        await prisma.event.delete({ where: { id: eventId } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: '删除日程失败' });
    }
});

// --- CRON JOB ---
cron.schedule('* * * * *', async () => {
  const now = new Date();
  console.log(`\n[${now.toLocaleTimeString()}] Running a check for reminders...`);

  try {
    const eventsToRemind = await prisma.event.findMany({
      where: {
        isReminderSent: false,
        reminderValue: { not: null },
        reminderUnit: { not: null },
      },
      include: { user: true },
    });

    if (eventsToRemind.length === 0) {
      return;
    }

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
      console.log(`[+] Found ${eventsToSend.length} event(s) to send reminders for.`);
      
      // 2. 【关键改动】遍历并调用邮件发送函数
      for (const event of eventsToSend) {
        console.log(`准备为日程: "${event.title}" 发送邮件给 ${event.user.email}`);
        try {
          await sendReminderEmail(event.user.email, event);
        } catch (mailError) {
          console.error(`为日程ID ${event.id} 发送邮件失败:`, mailError);
        }
      }

      const idsToUpdate = eventsToSend.map(e => e.id);
      await prisma.event.updateMany({
        where: { id: { in: idsToUpdate } },
        data: { isReminderSent: true },
      });
      console.log(`[✔] 已成功将会 ${idsToUpdate.length} 个日程标记为已发送。`);
    }
  } catch (error) {
    console.error('检查提醒任务时出错:', error);
  }
});


app.listen(PORT, () => {
  console.log(`🎉 Backend server is running on http://localhost:${PORT}`);
});
