// Router provisional para un módulo que todavía no se implementa.
// Responde 501 con un mensaje claro. Cuando su responsable desarrolle el módulo,
// reemplaza el contenido de su archivo <modulo>.routes.js; no hace falta tocar
// routes/index.js ni este archivo.
const { Router } = require('express');
const { errores } = require('./errores');

function moduloPendiente(nombre, responsable) {
  const router = Router();
  router.all('/{*resto}', () => {
    throw errores.noImplementado(`El módulo "${nombre}" aún no está implementado (responsable: ${responsable}).`);
  });
  return router;
}

module.exports = { moduloPendiente };
