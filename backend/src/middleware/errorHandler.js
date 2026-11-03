// Convierte cualquier error en la respuesta uniforme:
//   { ok: false, error: { codigo, mensaje, detalles } }
// Los errores inesperados se registran completos en los logs, pero al navegador
// solo llega un mensaje genérico (no se exponen detalles internos ni secretos).
const { AppError } = require('../shared/errores');

// Errores de conexión: el gestor no responde, la operación se puede reintentar.
const ERRORES_DE_CONEXION = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

function traducir(error) {
  if (error instanceof AppError) return error;

  // Errores del lector de JSON de Express
  if (error.type === 'entity.parse.failed') {
    return new AppError(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
  }
  if (error.type === 'entity.too.large') {
    return new AppError(413, 'CUERPO_DEMASIADO_GRANDE', 'La petición es demasiado grande.');
  }

  // PostgreSQL: violación de UNIQUE
  if (error.code === '23505') {
    return new AppError(409, 'DUPLICADO', 'Ya existe un registro con esos datos.');
  }

  const sinConexion = ERRORES_DE_CONEXION.has(error.code)
    || ['MongoServerSelectionError', 'MongoNetworkError', 'MongoTopologyClosedError', 'ClientClosedError']
      .includes(error.name)
    || /connection terminated|timeout exceeded when trying to connect/i.test(error.message || '');
  if (sinConexion) {
    return new AppError(503, 'SERVICIO_NO_DISPONIBLE',
      'Un servicio de datos no está disponible en este momento. Puedes reintentar en unos segundos.');
  }

  return null;
}

// Express reconoce un manejador de errores porque recibe 4 parámetros.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const conocido = traducir(error);

  // 501 (módulo pendiente) es esperado: no se registra como fallo.
  if (!conocido || (conocido.status >= 500 && conocido.status !== 501)) {
    console.error(`[api] ${req.method} ${req.originalUrl} →`, error);
  }

  const respuesta = conocido || new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intenta nuevamente.');
  res.status(respuesta.status).json({
    ok: false,
    error: {
      codigo: respuesta.codigo,
      mensaje: respuesta.message,
      detalles: respuesta.detalles,
    },
  });
}

module.exports = errorHandler;
