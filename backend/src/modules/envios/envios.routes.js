// Módulo envios — responsable: Liliana Averos (Dominio 1: solicitudes y envíos).
// Express 5 envía automáticamente al errorHandler los errores de funciones async.
const { Router } = require('express');
const controlador = require('./envios.controller');

const router = Router();

router.post('/', controlador.registrar);
router.get('/:codigo', controlador.consultar);
router.patch('/:codigo/aceptar', controlador.aceptar);
router.patch('/:codigo/cancelar', controlador.cancelar);

module.exports = router;
