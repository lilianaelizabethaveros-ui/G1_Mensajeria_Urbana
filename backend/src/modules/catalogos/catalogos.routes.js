// Módulo catalogos — responsable: Liliana Averos.
// Lectura de zonas y tipos de servicio activos (los usa el formulario de solicitud).
// El mantenimiento administrativo (crear, editar, desactivar) lo agrega Camila.
const { Router } = require('express');
const repositorio = require('./catalogos.repository');

const router = Router();

// GET /api/catalogos → { zonas, tipos_servicio }
router.get('/', async (req, res) => {
  const [zonas, tiposServicio] = await Promise.all([
    repositorio.listarZonasActivas(),
    repositorio.listarTiposServicioActivos(),
  ]);
  res.json({ ok: true, datos: { zonas, tipos_servicio: tiposServicio } });
});

module.exports = router;
