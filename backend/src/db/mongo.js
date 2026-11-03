// Cliente único de MongoDB, compartido por todos los módulos.
const { MongoClient } = require('mongodb');
const env = require('../config/env');

const { user, password, host, port, database } = env.mongo;
// encodeURIComponent evita errores si la clave tiene caracteres especiales.
const url = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/?authSource=admin`;

const cliente = new MongoClient(url, {
  serverSelectionTimeoutMS: env.tiempoMaximoSalud,
});

const db = cliente.db(database);

async function conectar() {
  await cliente.connect();
}

async function verificar() {
  // connect() no hace nada si ya hay conexión; si el arranque falló
  // (Mongo aún no estaba listo), aquí se vuelve a intentar.
  await cliente.connect();
  await db.command({ ping: 1 });
}

async function cerrar() {
  await cliente.close();
}

module.exports = { cliente, db, conectar, verificar, cerrar };
