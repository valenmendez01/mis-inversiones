// es un generador de contraseñas hasheadas para poner en la columna password de la base de datos

const bcrypt = require("bcryptjs");

async function generar() {
  const salt = await bcrypt.genSalt(10);
  const hashedPath = await bcrypt.hash("Independiente.01", salt);
  console.log("Tu hash es:", hashedPath);
}

generar();