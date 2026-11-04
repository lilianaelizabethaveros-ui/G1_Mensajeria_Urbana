// Módulo seguimiento — Dominio 3 (seguimiento y eventos).
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
// Incluye el sincronizador outbox → MongoDB (seguimiento.sincronizador.js), que arranca server.js.
const { Router } = require('express');
const controlador = require('./seguimiento.controller');

const router = Router();

// Rutas fijas antes de /:codigo
router.get('/sincronizador', controlador.sincronizador);
router.get('/repartidores/:codigo/tareas', controlador.tareas);
router.get('/:codigo', controlador.consultar);
router.post('/:codigo/eventos', controlador.registrarCambio);

module.exports = router;
