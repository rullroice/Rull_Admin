// src/routes/serviciosRoutes.js

const express = require('express');
const router  = express.Router();
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/serviciosController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/',    listar);
router.get('/:id', obtener);
router.post('/',   crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

module.exports = router;
