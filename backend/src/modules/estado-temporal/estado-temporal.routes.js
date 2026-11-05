// Módulo estado-temporal — Dominio 6 (última ubicación simulada y conexión del repartidor).
// Responsable: Liliana Averos 
const { Router } = require('express');
const controlador = require('./estado-temporal.controller');

const router = Router();

router.get('/repartidores', controlador.listar);
router.get('/repartidores/:codigo', controlador.consultar);
router.put('/repartidores/:codigo/ubicacion', controlador.actualizarUbicacion);
router.put('/repartidores/:codigo/conexion', controlador.actualizarConexion);
router.patch('/repartidores/:codigo/no-vigente', controlador.marcarNoVigente);

module.exports = router;
