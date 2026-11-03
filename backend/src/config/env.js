// Lee las variables de entorno en un solo lugar.
// Si falta una obligatoria, la API se detiene al arrancar con un mensaje claro.

function obligatoria(nombre) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env`);
  }
  return valor;
}

function entero(nombre, porDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return porDefecto;
  const numero = Number.parseInt(valor, 10);
  if (Number.isNaN(numero)) throw new Error(`La variable ${nombre} debe ser un número`);
  return numero;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  puerto: entero('PORT', 3000),

  postgres: {
    host: obligatoria('POSTGRES_HOST'),
    port: entero('POSTGRES_PORT', 5432),
    database: obligatoria('POSTGRES_DB'),
    user: obligatoria('POSTGRES_USER'),
    password: obligatoria('POSTGRES_PASSWORD'),
  },

  mongo: {
    host: obligatoria('MONGO_HOST'),
    port: entero('MONGO_PORT', 27017),
    database: obligatoria('MONGO_DB'),
    user: obligatoria('MONGO_USER'),
    password: obligatoria('MONGO_PASSWORD'),
  },

  redis: {
    host: obligatoria('REDIS_HOST'),
    port: entero('REDIS_PORT', 6379),
    password: obligatoria('REDIS_PASSWORD'),
  },

  // Tiempo máximo (ms) para que un gestor responda en /health
  tiempoMaximoSalud: entero('HEALTH_TIMEOUT_MS', 2000),
};

module.exports = env;
