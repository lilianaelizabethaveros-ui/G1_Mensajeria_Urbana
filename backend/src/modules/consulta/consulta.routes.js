'use strict';

const express = require('express');
const controlador = require('./consulta.controller');

const router = express.Router();

// Consultar envíos con filtros opcionales.
router.get('/', controlador.buscarEnvios);

module.exports = router;
