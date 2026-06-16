// src/routes/boletasRoutes.js

const express = require('express');
const router  = express.Router();
const { listar, obtener, emitir } = require('../controllers/boletasController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/',    listar);
router.get('/:id', obtener);
router.post('/',   emitir);

module.exports = router;
