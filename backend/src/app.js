// Configuración de Express: middlewares, rutas de la API, web estática y errores.
const path = require('node:path');
const express = require('express');
const healthRoutes = require('./modules/health/health.routes');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Salud de la API y de los gestores
app.use('/health', healthRoutes);

// API REST: cada módulo bajo /api/<prefijo>; rutas inexistentes → 404 JSON
app.use('/api', apiRoutes);
app.use('/api', notFound);

// Web estática (frontend/). En el contenedor está en /app/frontend.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Siempre al final
app.use(errorHandler);

module.exports = app;
