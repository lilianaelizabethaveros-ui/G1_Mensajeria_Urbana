const servicio = require('./despacho.service');
const { validar } = require('../../shared/validacion');

// Asignar un repartidor a un envío.
async function asignar(req, res) {
  const datos = validar(req.body, {
    codigo_envio: {
      tipo: 'texto',
      requerido: true
    },
    codigo_repartidor: {
      tipo: 'texto',
      requerido: true
    }
  });

  const resultado = await servicio.asignar(
    datos.codigo_envio,
    datos.codigo_repartidor
  );

  res.status(resultado.idempotente ? 200 : 201).json({
    ok: true,
    datos: resultado
  });
}


async function liberar(req, res) {
  const resultado = await servicio.liberar(req.params.codigo);

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}


async function reasignar(req, res) {
  const datos = validar(req.body, {
    codigo_repartidor: {
      tipo: 'texto',
      requerido: true
    }
  });

  const resultado = await servicio.reasignar(
    req.params.codigo,
    datos.codigo_repartidor
  );

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}

// Consultar los repartidores registrados.
async function listarRepartidores(req, res) {
  const resultado = await servicio.listarRepartidores();

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}

// Consultar los envíos aceptados pendientes de asignación.
async function listarEnviosPendientes(req, res) {
  const resultado = await servicio.listarEnviosPendientes();

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}
// Consultar todas las zonas para el panel administrativo.
async function listarZonas(req, res) {
  const resultado = await servicio.listarZonas();

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}

// Crear una nueva zona desde el panel administrativo.
async function crearZona(req, res) {
  const datos = validar(req.body, {
    codigo: { tipo: 'texto', requerido: true },
    nombre: { tipo: 'texto', requerido: true }
  });

  const resultado = await servicio.crearZona(
    datos.codigo,
    datos.nombre
  );

  res.status(201).json({
    ok: true,
    datos: resultado
  });
}

// Editar el nombre y estado de una zona.
async function actualizarZona(req, res) {
  const datos = validar(req.body, {
    nombre: { tipo: 'texto', requerido: true },
    activa: { tipo: 'booleano', requerido: true }
  });

  const resultado = await servicio.actualizarZona(
    req.params.codigo,
    datos.nombre,
    datos.activa
  );

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}


// Actualizar los datos y la capacidad de un repartidor.
async function actualizarRepartidor(req, res) {
  const datos = validar(req.body, {
    nombre: { tipo: 'texto', requerido: true },
    zona: { tipo: 'texto', requerido: true },
    capacidad_maxima: { tipo: 'entero', requerido: true },
    activo: { tipo: 'booleano', requerido: true }
  });

  const resultado = await servicio.actualizarRepartidor(
    req.params.codigo,
    datos.nombre,
    datos.zona,
    datos.capacidad_maxima,
    datos.activo
  );

  res.status(200).json({
    ok: true,
    datos: resultado
  });
}


// Crear un nuevo repartidor.
async function crearRepartidor(req, res) {
  const datos = validar(req.body, {
    codigo: {
      tipo: 'texto',
      requerido: true
    },
    nombre: {
      tipo: 'texto',
      requerido: true
    },
    zona: {
      tipo: 'texto',
      requerido: true
    },
    capacidad_maxima: {
      tipo: 'entero',
      requerido: true,
      min: 1
    }
  });

  const resultado = await servicio.crearRepartidor(
    datos.codigo,
    datos.nombre,
    datos.zona,
    datos.capacidad_maxima
  );

  res.status(201).json({
    ok: true,
    datos: resultado
  });
}



module.exports = { asignar, liberar, reasignar, listarRepartidores, listarEnviosPendientes, 
  listarZonas, crearZona, actualizarZona, actualizarRepartidor, crearRepartidor };
