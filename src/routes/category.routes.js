// src/routes/category.routes.js
const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/category.controller');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.use(authenticateToken); // 对此路由下的所有接口应用认证中间件

router.get('/', categoryController.getAllCategories);
router.post('/', [
    body('name').notEmpty(),
    body('color').isHexColor()
], categoryController.createCategory);
router.put('/:id', [
    body('name').notEmpty(),
    body('color').isHexColor()
], categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
