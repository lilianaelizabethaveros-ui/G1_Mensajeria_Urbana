// Validación compartida, sin dependencias externas (decisión D11).
//
// Uso:
//   const datos = validar(req.body, {
//     nombre: { tipo: 'texto', requerido: true, min: 2, max: 80 },
//     peso_kg: { tipo: 'numero', requerido: true, min: 0.1, max: 50 },
//     tipo_servicio: { tipo: 'opcion', requerido: true, opciones: ['ESTANDAR', 'EXPRESS'] },
//   });
//
// Devuelve un objeto NUEVO solo con los campos del esquema (los campos extra que
// envíe el navegador se ignoran). Si hay errores lanza AppError 400 con un
// detalle por campo: [{ campo, mensaje }].
const { errores } = require('./errores');

const TIPOS = {
  texto(valor, regla, campo) {
    if (typeof valor !== 'string') return { error: `${campo} debe ser texto.` };
    const limpio = valor.trim().replace(/\s+/g, ' ');
    if (regla.requerido && limpio === '') return { error: `${campo} es obligatorio.` };
    if (regla.min !== undefined && limpio.length < regla.min) {
      return { error: `${campo} debe tener al menos ${regla.min} caracteres.` };
    }
    if (regla.max !== undefined && limpio.length > regla.max) {
      return { error: `${campo} debe tener como máximo ${regla.max} caracteres.` };
    }
    if (regla.patron && !regla.patron.test(limpio)) {
      return { error: regla.mensajePatron || `${campo} no tiene un formato válido.` };
    }
    return { valor: limpio };
  },

  entero(valor, regla, campo) {
    const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
    if (!Number.isInteger(numero)) return { error: `${campo} debe ser un número entero.` };
    return rango(numero, regla, campo);
  },

  numero(valor, regla, campo) {
    const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
    if (typeof numero !== 'number' || !Number.isFinite(numero)) {
      return { error: `${campo} debe ser un número.` };
    }
    return rango(numero, regla, campo);
  },

  booleano(valor, regla, campo) {
    if (typeof valor !== 'boolean') return { error: `${campo} debe ser verdadero o falso.` };
    return { valor };
  },

  opcion(valor, regla, campo) {
    const texto = typeof valor === 'string' ? valor.trim().toUpperCase() : valor;
    if (!regla.opciones.includes(texto)) {
      return { error: `${campo} debe ser uno de: ${regla.opciones.join(', ')}.` };
    }
    return { valor: texto };
  },
};

function rango(numero, regla, campo) {
  if (regla.min !== undefined && numero < regla.min) return { error: `${campo} debe ser como mínimo ${regla.min}.` };
  if (regla.max !== undefined && numero > regla.max) return { error: `${campo} debe ser como máximo ${regla.max}.` };
  return { valor: numero };
}

function estaVacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function validar(cuerpo, esquema) {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw errores.validacion([{ campo: '(cuerpo)', mensaje: 'Se esperaba un objeto JSON.' }]);
  }

  const resultado = {};
  const detalles = [];

  for (const [campo, regla] of Object.entries(esquema)) {
    const validador = TIPOS[regla.tipo];
    if (!validador) throw new Error(`Tipo de validación desconocido: ${regla.tipo}`);

    const valor = cuerpo[campo];
    if (estaVacio(valor)) {
      if (regla.requerido) detalles.push({ campo, mensaje: `${campo} es obligatorio.` });
      else if (regla.porDefecto !== undefined) resultado[campo] = regla.porDefecto;
      continue;
    }

    const { valor: limpio, error } = validador(valor, regla, campo);
    if (error) detalles.push({ campo, mensaje: error });
    else resultado[campo] = limpio;
  }

  if (detalles.length > 0) throw errores.validacion(detalles);
  return resultado;
}

module.exports = { validar };
