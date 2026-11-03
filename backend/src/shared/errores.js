// Errores de negocio con su código HTTP. Los módulos lanzan AppError y el
// middleware errorHandler los convierte en una respuesta JSON uniforme:
// { ok: false, error: { codigo, mensaje, detalles } }

class AppError extends Error {
  /**
   * @param {number} status   Código HTTP (400, 404, 409, 503...)
   * @param {string} codigo   Código estable para el frontend, en MAYÚSCULAS
   * @param {string} mensaje  Texto comprensible para la persona usuaria
   * @param {Array}  detalles Lista opcional, por ejemplo errores por campo
   */
  constructor(status, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const errores = {
  validacion: (detalles, mensaje = 'Los datos enviados no son válidos.') =>
    new AppError(400, 'VALIDACION', mensaje, detalles),
  noEncontrado: (mensaje = 'No se encontró el recurso solicitado.') =>
    new AppError(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (codigo, mensaje) => new AppError(409, codigo, mensaje),
  noImplementado: (mensaje) => new AppError(501, 'NO_IMPLEMENTADO', mensaje),
  noDisponible: (mensaje = 'Un servicio necesario no está disponible. Puedes reintentar en unos segundos.') =>
    new AppError(503, 'SERVICIO_NO_DISPONIBLE', mensaje),
};

module.exports = { AppError, errores };
