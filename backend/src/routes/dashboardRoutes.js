// src/routes/dashboardRoutes.js

const express = require('express');
const router  = express.Router();
const { resumen } = require('../controllers/dashboardController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', resumen);

module.exports = router;
