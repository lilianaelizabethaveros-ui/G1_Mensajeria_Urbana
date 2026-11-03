const { conTransaccion } = require('../../db/postgres');
const { registrarEvento } = require('../../shared/outbox');
const { ESTADOS, validarTransicion } = require('../../shared/estados');
const { errores } = require('../../shared/errores');
const {
  normalizarCodigo,
  esCodigoEnvio,
  esCodigoRepartidor
} = require('../../shared/identificadores');

const repositorio = require('./despacho.repository');

 // Asignar un repartidor a un envío aceptado.
async function asignar(codigoEnvio, codigoRepartidor) {
  const envioCodigo = normalizarCodigo(codigoEnvio);
  const repartidorCodigo = normalizarCodigo(codigoRepartidor);

  if (!esCodigoEnvio(envioCodigo)) {
    throw errores.validacion([
      { campo: 'codigo_envio', mensaje: 'Código de envío inválido.' }
    ]);
  }

  if (!esCodigoRepartidor(repartidorCodigo)) {
    throw errores.validacion([
      { campo: 'codigo_repartidor', mensaje: 'Código de repartidor inválido.' }
    ]);
  }

  return conTransaccion(async (cliente) => {
    // Bloquear el envío para evitar asignaciones simultáneas.
    const envio = await repositorio.bloquearEnvio(cliente, envioCodigo);

    if (!envio) {
      throw errores.noEncontrado('No se encontró el envío.');
    }

    // D33: si ya está asignado al mismo repartidor,
    // devolver la asignación existente sin duplicarla.
    if (envio.estado === ESTADOS.ASIGNADO) {
      const asignacionActual = await repositorio.buscarAsignacionActiva(
        cliente,
        envio.codigo
      );

      if (
        asignacionActual &&
        asignacionActual.codigo_repartidor === repartidorCodigo
      ) {
        return {
          codigo_envio: envio.codigo,
          estado: envio.estado,
          repartidor: {
            codigo: asignacionActual.codigo_repartidor
          },
          asignacion_id: asignacionActual.id,
          asignada_en: asignacionActual.asignada_en,
          idempotente: true
        };
      }
    }

    // Solo los envíos aceptados pueden asignarse.
    validarTransicion(envio.estado, ESTADOS.ASIGNADO);

    // Bloquear el repartidor para controlar su capacidad.
    const repartidor = await repositorio.bloquearRepartidor(
      cliente,
      repartidorCodigo
    );

    if (!repartidor) {
      throw errores.noEncontrado('No se encontró el repartidor.');
    }

    if (!repartidor.activo) {
      throw errores.conflicto(
        'REPARTIDOR_INACTIVO',
        'El repartidor no está activo.'
      );
    }

    if (repartidor.zona_id !== envio.destino_zona_id) {
      throw errores.conflicto(
        'ZONA_NO_COINCIDE',
        'El repartidor no pertenece a la zona de destino.'
      );
    }

    if (repartidor.asignaciones_activas >= repartidor.capacidad_maxima) {
      throw errores.conflicto(
        'CAPACIDAD_AGOTADA',
        'El repartidor alcanzó su capacidad máxima.'
      );
    }

    // Registrar la asignación.
    const asignacion = await repositorio.crearAsignacion(
      cliente,
      envio.codigo,
      repartidor.id
    );

    // Cambiar ACEPTADO → ASIGNADO.
    const actualizado = await repositorio.marcarAsignado(
      cliente,
      envio.codigo
    );

    if (!actualizado) {
      throw errores.conflicto(
        'TRANSICION_INVALIDA',
        'No fue posible actualizar el estado del envío.'
      );
    }

    // Registrar el evento dentro de la misma transacción.
    await registrarEvento(cliente, {
      codigoEnvio: envio.codigo,
      tipo: ESTADOS.ASIGNADO,
      actor: 'OPERADOR',
      datos: {
        estado_anterior: envio.estado,
        repartidor_codigo: repartidor.codigo
      }
    });

    return {
      codigo_envio: actualizado.codigo,
      estado: actualizado.estado,
      repartidor: {
        codigo: repartidor.codigo,
        nombre: repartidor.nombre
      },
      asignacion_id: asignacion.id,
      asignada_en: asignacion.asignada_en,
      idempotente: false
    };
  });
}

async function liberar(codigoEnvio) {
  const envioCodigo = normalizarCodigo(codigoEnvio);

  if (!esCodigoEnvio(envioCodigo)) {
    throw errores.validacion([
      {
        campo: 'codigo_envio',
        mensaje: 'Código de envío inválido.'
      }
    ]);
  }

  return conTransaccion(async cliente => {
    // Bloquear el envío para evitar cambios simultáneos.
    const envio = await repositorio.bloquearEnvio(
      cliente,
      envioCodigo
    );

    if (!envio) {
      throw errores.noEncontrado('No se encontró el envío.');
    }

    // Comprobar que ASIGNADO -> ACEPTADO esté permitido.
    validarTransicion(envio.estado, ESTADOS.ACEPTADO);

    // Buscar la asignación que sigue activa.
    const asignacion = await repositorio.buscarAsignacionActiva(
      cliente,
      envio.codigo
    );

    if (!asignacion) {
      throw errores.conflicto(
        'ASIGNACION_NO_ENCONTRADA',
        'El envío no tiene una asignación activa.'
      );
    }

    // Registrar la liberación sin borrar el historial.
    const liberada = await repositorio.liberarAsignacion(
      cliente,
      asignacion.id
    );

    if (!liberada) {
      throw errores.conflicto(
        'ASIGNACION_NO_ENCONTRADA',
        'No fue posible liberar la asignación.'
      );
    }

    // Regresar el envío al estado ACEPTADO.
    const actualizado = await repositorio.marcarAceptado(
      cliente,
      envio.codigo
    );

    if (!actualizado) {
      throw errores.conflicto(
        'TRANSICION_INVALIDA',
        'No fue posible actualizar el estado del envío.'
      );
    }

    // Registrar el cambio en la misma transacción.
    await registrarEvento(cliente, {
      codigoEnvio: envio.codigo,
      tipo: ESTADOS.ACEPTADO,
      actor: 'OPERADOR',
      datos: {
        estado_anterior: envio.estado,
        repartidor_codigo: asignacion.codigo_repartidor,
        motivo: 'LIBERACION_ASIGNACION'
      }
    });

    return {
      codigo_envio: actualizado.codigo,
      estado: actualizado.estado,
      repartidor_liberado: asignacion.codigo_repartidor,
      asignacion_id: liberada.id,
      liberada_en: liberada.liberada_en
    };
  });
}


async function reasignar(codigoEnvio, codigoRepartidor) {
  const envioCodigo = normalizarCodigo(codigoEnvio);
  const repartidorCodigo = normalizarCodigo(codigoRepartidor);

  if (!esCodigoEnvio(envioCodigo)) {
    throw errores.validacion([
      { campo: 'codigo_envio', mensaje: 'Código de envío inválido.' }
    ]);
  }

  if (!esCodigoRepartidor(repartidorCodigo)) {
    throw errores.validacion([
      { campo: 'codigo_repartidor', mensaje: 'Código de repartidor inválido.' }
    ]);
  }

  return conTransaccion(async cliente => {
    // Bloquear el envío para evitar reasignaciones simultáneas.
    const envio = await repositorio.bloquearEnvio(
      cliente, envioCodigo
    );

    if (!envio) {
      throw errores.noEncontrado('No se encontró el envío.');
    }

    // Solo se permite reasignar envíos en estado ASIGNADO.
    if (envio.estado !== ESTADOS.ASIGNADO) {
      throw errores.conflicto(
        'TRANSICION_INVALIDA',
        'Solo se pueden reasignar envíos en estado ASIGNADO.'
      );
    }

    const anterior = await repositorio.buscarAsignacionActiva(
      cliente, envio.codigo
    );

    if (!anterior) {
      throw errores.conflicto(
        'ASIGNACION_NO_ENCONTRADA',
        'El envío no tiene una asignación activa.'
      );
    }

    if (anterior.codigo_repartidor === repartidorCodigo) {
      throw errores.conflicto(
        'MISMO_REPARTIDOR',
        'El envío ya está asignado a ese repartidor.'
      );
    }

    // Bloquear al nuevo repartidor y comprobar su disponibilidad.
    const nuevo = await repositorio.bloquearRepartidor(
      cliente, repartidorCodigo
    );

    if (!nuevo) {
      throw errores.noEncontrado('No se encontró el repartidor.');
    }

    if (!nuevo.activo) {
      throw errores.conflicto(
        'REPARTIDOR_INACTIVO',
        'El repartidor no está activo.'
      );
    }

    if (nuevo.zona_id !== envio.destino_zona_id) {
      throw errores.conflicto(
        'ZONA_NO_COINCIDE',
        'El repartidor no pertenece a la zona de destino.'
      );
    }

    if (nuevo.asignaciones_activas >= nuevo.capacidad_maxima) {
      throw errores.conflicto(
        'CAPACIDAD_AGOTADA',
        'El repartidor alcanzó su capacidad máxima.'
      );
    }

    // Liberar la asignación anterior.
    const liberada = await repositorio.liberarAsignacion(
      cliente, anterior.id
    );

    if (!liberada) {
      throw errores.conflicto(
        'ASIGNACION_NO_ENCONTRADA',
        'No fue posible liberar la asignación anterior.'
      );
    }

    // Crear la nueva asignación.
    const asignacion = await repositorio.crearReasignacion(
      cliente, envio.codigo, nuevo.id
    );

    // Registrar el cambio sin alterar el estado ASIGNADO.
    await registrarEvento(cliente, {
      codigoEnvio: envio.codigo,
      tipo: ESTADOS.ASIGNADO,
      actor: 'OPERADOR',
      datos: {
        motivo: 'REASIGNACION',
        repartidor_anterior: anterior.codigo_repartidor,
        repartidor_nuevo: nuevo.codigo
      }
    });

    return {
      codigo_envio: envio.codigo,
      estado: envio.estado,
      repartidor_anterior: anterior.codigo_repartidor,
      repartidor_nuevo: nuevo.codigo,
      asignacion_id: asignacion.id,
      asignada_en: asignacion.asignada_en
    };
  });
}

// Consultar los repartidores registrados.
async function listarRepartidores() {
  return repositorio.listarRepartidores();
}

// Consultar los envíos aceptados pendientes de asignación.
async function listarEnviosPendientes() {
  return repositorio.listarEnviosPendientes();
}

// Consultar todas las zonas para el panel administrativo.
async function listarZonas() {
  return repositorio.listarZonas();
}

// Crear una zona desde el panel administrativo.
async function crearZona(codigo, nombre) {
  if (typeof codigo !== 'string' || !/^[A-Z0-9_]{2,10}$/.test(codigo)) {
    throw errores.validacion([
      {
        campo: 'codigo',
        mensaje: 'El código debe tener entre 2 y 10 caracteres: letras mayúsculas, números o guion bajo.'
      }
    ]);
  }

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 80) {
    throw errores.validacion([
      {
        campo: 'nombre',
        mensaje: 'El nombre es obligatorio y debe tener máximo 80 caracteres.'
      }
    ]);
  }

  try {
    return await repositorio.crearZona(codigo, nombre.trim());
  } catch (error) {
    // PostgreSQL: código único duplicado.
    if (error.code === '23505') {
      throw errores.conflicto(
        'ZONA_DUPLICADA',
        'Ya existe una zona con ese código.'
      );
    }

    throw error;
  }
}

// Editar el nombre o estado de una zona existente.
async function actualizarZona(codigo, nombre, activa) {
  if (typeof codigo !== 'string' || !/^[A-Z0-9_]{2,10}$/.test(codigo)) {
    throw errores.validacion([
      {
        campo: 'codigo',
        mensaje: 'El código de zona no es válido.'
      }
    ]);
  }

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 80) {
    throw errores.validacion([
      {
        campo: 'nombre',
        mensaje: 'El nombre es obligatorio y debe tener máximo 80 caracteres.'
      }
    ]);
  }

  if (typeof activa !== 'boolean') {
    throw errores.validacion([
      {
        campo: 'activa',
        mensaje: 'El estado de la zona debe ser verdadero o falso.'
      }
    ]);
  }

  const zona = await repositorio.actualizarZona(
    codigo,
    nombre.trim(),
    activa
  );

  if (!zona) {
    throw errores.noEncontrado('No se encontró la zona.');
  }

  return zona;
}


// Actualizar un repartidor y proteger su capacidad operativa.
async function actualizarRepartidor(codigo, nombre, zonaCodigo, capacidadMaxima, activo) {
  const repartidorCodigo = normalizarCodigo(codigo);

  if (!esCodigoRepartidor(repartidorCodigo)) {
    throw errores.validacion([
      { campo: 'codigo', mensaje: 'Código de repartidor inválido.' }
    ]);
  }

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 80) {
    throw errores.validacion([
      { campo: 'nombre', mensaje: 'El nombre debe tener entre 1 y 80 caracteres.' }
    ]);
  }

  if (typeof zonaCodigo !== 'string' || !/^[A-Z0-9_]{2,10}$/.test(zonaCodigo)) {
    throw errores.validacion([
      { campo: 'zona', mensaje: 'Código de zona inválido.' }
    ]);
  }

  if (!Number.isInteger(capacidadMaxima) || capacidadMaxima <= 0) {
    throw errores.validacion([
      { campo: 'capacidad_maxima', mensaje: 'La capacidad debe ser un entero mayor que cero.' }
    ]);
  }

  if (typeof activo !== 'boolean') {
    throw errores.validacion([
      { campo: 'activo', mensaje: 'El estado debe ser verdadero o falso.' }
    ]);
  }

  return conTransaccion(async (cliente) => {
    // Bloquear al repartidor para evitar cambios simultáneos de capacidad.
    const repartidor = await repositorio.bloquearRepartidor(
      cliente,
      repartidorCodigo
    );

    if (!repartidor) {
      throw errores.noEncontrado('No se encontró el repartidor.');
    }

    // No permitir una capacidad menor que las asignaciones activas.
    if (capacidadMaxima < repartidor.asignaciones_activas) {
      throw errores.conflicto(
        'CAPACIDAD_INSUFICIENTE',
        'La capacidad no puede ser menor que la carga actual del repartidor.'
      );
    }

    // Verificar que la zona exista y esté activa.
    const zonas = await cliente.query(
      `SELECT id
       FROM zonas
       WHERE codigo = $1 AND activa = true`,
      [zonaCodigo]
    );

    if (zonas.rows.length === 0) {
      throw errores.validacion([
        { campo: 'zona', mensaje: 'La zona no existe o está inactiva.' }
      ]);
    }

    const resultado = await cliente.query(
      `UPDATE repartidores
       SET nombre = $2,
           zona_id = $3,
           capacidad_maxima = $4,
           activo = $5
       WHERE codigo = $1
       RETURNING id, codigo, nombre, zona_id, capacidad_maxima, activo`,
      [
        repartidorCodigo,
        nombre.trim(),
        zonas.rows[0].id,
        capacidadMaxima,
        activo
      ]
    );

    return resultado.rows[0];
  });
}


 // Crear un repartidor desde el panel administrativo.
async function crearRepartidor(codigo, nombre, zonaCodigo, capacidadMaxima) {
  const repartidorCodigo = normalizarCodigo(codigo);

  if (!esCodigoRepartidor(repartidorCodigo)) {
    throw errores.validacion([
      {
        campo: 'codigo',
        mensaje: 'El código debe tener el formato REP-NNN.'
      }
    ]);
  }

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    nombre.trim().length > 80
  ) {
    throw errores.validacion([
      {
        campo: 'nombre',
        mensaje: 'El nombre es obligatorio y debe tener máximo 80 caracteres.'
      }
    ]);
  }

  const zonaNormalizada = normalizarCodigo(zonaCodigo);

  if (!/^[A-Z0-9_]{2,10}$/.test(zonaNormalizada)) {
    throw errores.validacion([
      {
        campo: 'zona',
        mensaje: 'El código de zona no es válido.'
      }
    ]);
  }

  if (!Number.isInteger(capacidadMaxima) || capacidadMaxima <= 0) {
    throw errores.validacion([
      {
        campo: 'capacidad_maxima',
        mensaje: 'La capacidad debe ser un entero mayor que cero.'
      }
    ]);
  }

  // Consultar la zona sin modificar el módulo compartido catalogos.
  const zonas = await repositorio.listarZonas();
  const zona = zonas.find(
    item => item.codigo === zonaNormalizada && item.activa
  );

  if (!zona) {
    throw errores.validacion([
      {
        campo: 'zona',
        mensaje: 'La zona no existe o está inactiva.'
      }
    ]);
  }

  try {
    return await repositorio.crearRepartidor(
      repartidorCodigo,
      nombre.trim(),
      zona.id,
      capacidadMaxima
    );
  } catch (error) {
    if (error.code === '23505') {
      throw errores.conflicto(
        'REPARTIDOR_DUPLICADO',
        'Ya existe un repartidor con ese código.'
      );
    }

    throw error;
  }
}



module.exports = { asignar, liberar, liberar, reasignar, listarRepartidores, listarEnviosPendientes, listarZonas, 
  crearZona, actualizarZona, actualizarRepartidor, crearRepartidor };
