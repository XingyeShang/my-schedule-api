// src/controllers/event.controller.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { addDays, addWeeks, addMonths, isWithinInterval } = require('date-fns');
const prisma = new PrismaClient();

exports.getAllEvents = async (req, res) => {
    const userId = req.user.userId;
    const { start, end, categoryId, search } = req.query;
    try {
        const whereClause = {
            userId: userId,
            ...(categoryId && { categoryId: parseInt(categoryId, 10) }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const baseEvents = await prisma.event.findMany({ where: whereClause });
            const allEvents = [];
            baseEvents.forEach(event => {
                if (!event.recurrence) {
                    if (event.startTime < endDate && event.endTime > startDate) {
                        allEvents.push(event);
                    }
                } else {
                    let currentDate = event.startTime;
                    const duration = event.endTime.getTime() - currentDate.getTime();
                    while (currentDate <= endDate) {
                        if (currentDate >= startDate) {
                            allEvents.push({
                                ...event,
                                recurrentEventId: `${event.id}-${currentDate.toISOString()}`,
                                startTime: currentDate,
                                endTime: new Date(currentDate.getTime() + duration),
                            });
                        }
                        switch (event.recurrence) {
                            case 'daily': currentDate = addDays(currentDate, 1); break;
                            case 'weekly': currentDate = addWeeks(currentDate, 1); break;
                            case 'monthly': currentDate = addMonths(currentDate, 1); break;
                            default: currentDate = new Date(endDate.getTime() + 1); break;
                        }
                    }
                }
            });
            res.json(allEvents);
        } else {
            const allBaseEvents = await prisma.event.findMany({
                where: whereClause,
                orderBy: { startTime: 'desc' }
            });
            res.json(allBaseEvents);
        }
    } catch (error) {
        console.error("获取日程失败:", error);
        res.status(500).json({ error: "获取日程数据时发生错误。" });
    }
};

exports.createEvent = async (req, res) => {
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
                categoryId: categoryId ? parseInt(categoryId, 10) : null,
                userId: req.user.userId,
            },
        });
        res.status(201).json(newEvent);
    } catch (error) {
        res.status(500).json({ error: '创建日程失败' });
    }
};

exports.updateEvent = async (req, res) => {
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
                categoryId: categoryId ? parseInt(categoryId, 10) : null,
            },
        });
        res.json(updatedEvent);
    } catch (error) {
        res.status(500).json({ error: '更新日程失败' });
    }
};

exports.deleteEvent = async (req, res) => {
    const eventId = parseInt(req.params.id);
    try {
        const event = await prisma.event.findFirst({ where: { id: eventId, userId: req.user.userId } });
        if (!event) return res.status(404).json({ error: '日程未找到或无权限' });
        await prisma.event.delete({ where: { id: eventId } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: '删除日程失败' });
    }
};
