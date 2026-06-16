// src/routes/equiposRoutes.js

const express = require('express');
const router  = express.Router();
const { listar, obtener, crear, actualizar, cambiarEstado, eliminar } = require('../controllers/equiposController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/',           listar);
router.get('/:id',        obtener);
router.post('/',          crear);
router.put('/:id',        actualizar);
router.patch('/:id/estado', cambiarEstado);
router.delete('/:id',     eliminar);

module.exports = router;
