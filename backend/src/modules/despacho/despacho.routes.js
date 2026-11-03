const { Router } = require('express');
const controlador = require('./despacho.controller');

const router = Router();

// Asignar un repartidor a un envío.
router.post('/asignaciones', controlador.asignar);

// Liberar la asignación de un envío.
router.patch('/asignaciones/:codigo/liberar', controlador.liberar);

// Cambiar el repartidor asignado a un envío.
router.patch('/asignaciones/:codigo/reasignar', controlador.reasignar);

// Consultar los repartidores registrados.
router.get('/repartidores', controlador.listarRepartidores);

// Consultar envíos aceptados pendientes de asignación.
router.get('/pendientes', controlador.listarEnviosPendientes);

// Consultar todas las zonas para el panel administrativo.
router.get('/admin/zonas', controlador.listarZonas);

// Crear una zona desde el panel administrativo.
router.post('/admin/zonas', controlador.crearZona);

// Editar o desactivar una zona existente.
router.patch('/admin/zonas/:codigo', controlador.actualizarZona);

// Actualizar los datos y la capacidad de un repartidor.
router.patch(
  '/admin/repartidores/:codigo',
  controlador.actualizarRepartidor
);

// Crear un repartidor desde el panel administrativo.
router.post('/admin/repartidores', controlador.crearRepartidor);

module.exports = router;
