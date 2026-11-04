// Módulo evidencias — Dominio 4 (evidencias de entrega).
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
// Express 5 envía automáticamente al errorHandler los errores de funciones async.
const { Router } = require('express');
const controlador = require('./evidencias.controller');

const router = Router();

router.post('/', controlador.registrar);
router.get('/', controlador.listar);
router.get('/huerfanas', controlador.huerfanas);   // antes de /:clave
router.get('/:clave', controlador.consultar);

module.exports = router;
