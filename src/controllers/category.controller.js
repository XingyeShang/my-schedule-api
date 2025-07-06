// src/controllers/category.controller.js
const { validationResult } = require('express-validator');
const prisma = require('../lib/prisma');

exports.getAllCategories = async (req, res) => {
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
};

exports.createCategory = async (req, res) => {
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
};

exports.updateCategory = async (req, res) => {
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
};

exports.deleteCategory = async (req, res) => {
  const categoryId = parseInt(req.params.id);
  const userId = req.user.userId;
  try {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: userId }
    });
    if (!category) {
      return res.status(404).json({ error: '分类未找到或无权限' });
    }
    await prisma.category.delete({
      where: { id: categoryId },
    });
    res.status(204).send();
  } catch (error) {
    console.error("删除分类时出错:", error);
    res.status(500).json({ error: '删除分类失败' });
  }
};