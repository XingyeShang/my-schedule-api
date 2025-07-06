// src/routes/event.routes.js
const express = require('express');
const { body } = require('express-validator');
const eventController = require('../controllers/event.controller');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.use(authenticateToken);

router.get('/', eventController.getAllEvents);
router.post('/', [
    body('title').notEmpty(),
    body('startTime').isISO8601(),
    body('endTime').isISO8601(),
], eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;