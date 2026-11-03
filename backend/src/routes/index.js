// Registro ÚNICO de módulos (decisión D6). Cada módulo es dueño de su prefijo.
// Este archivo ya registra los ocho módulos: para desarrollar un módulo NO hace
// falta editarlo; basta con implementar el archivo <modulo>.routes.js propio.
const { Router } = require('express');

const router = Router();

router.use('/catalogos', require('../modules/catalogos/catalogos.routes'));            // Liliana
router.use('/envios', require('../modules/envios/envios.routes'));                     // Liliana
router.use('/despacho', require('../modules/despacho/despacho.routes'));               // Camila
router.use('/consulta', require('../modules/consulta/consulta.routes'));               // Camila
router.use('/seguimiento', require('../modules/seguimiento/seguimiento.routes'));      // Juan Fernando
router.use('/evidencias', require('../modules/evidencias/evidencias.routes'));         // Juan Fernando
router.use('/estado-temporal', require('../modules/estado-temporal/estado-temporal.routes')); // Juan Fernando

module.exports = router;
