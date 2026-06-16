// src/routes/cajaRoutes.js

const express = require('express');
const router  = express.Router();
const { equiposListos } = require('../controllers/cajaController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', equiposListos);

module.exports = router;
