// 404 en formato JSON para cualquier ruta /api que no exista.
const { errores } = require('../shared/errores');

function notFound(req, res, next) {
  next(errores.noEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe.`));
}

module.exports = notFound;
