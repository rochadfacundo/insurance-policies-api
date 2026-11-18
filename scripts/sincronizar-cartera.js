
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const origen = path.resolve(__dirname, "../lib");
const destino = path.resolve(__dirname, "../functions-cartera/lib");

const pendientes = ["index.js"];
const procesados = new Set();

function sincronizar(archivo) {
  const rutaOrigen = path.resolve(origen, archivo);

  if (
    rutaOrigen !== origen &&
    !rutaOrigen.startsWith(origen + path.sep)
  ) {
    throw new Error(`Ruta fuera de lib: ${archivo}`);
  }

  if (procesados.has(rutaOrigen)) return;

  if (!fs.existsSync(rutaOrigen)) {
    throw new Error(`Archivo faltante: ${rutaOrigen}`);
  }

  procesados.add(rutaOrigen);

  const contenido = fs.readFileSync(rutaOrigen, "utf8");

  // Detectar imports CommonJS generados por TypeScript.
  const expresion = /require\(["'](\.[^"']+)["']\)/g;

  for (const coincidencia of contenido.matchAll(expresion)) {
    const modulo = coincidencia[1];

    const resolver = createRequire(rutaOrigen);
    const dependencia = resolver.resolve(modulo);

    if (!dependencia.startsWith(origen + path.sep)) {
      throw new Error(
        `Dependencia local fuera de lib: ${modulo}`
      );
    }

    pendientes.push(path.relative(origen, dependencia));
  }

  const rutaDestino = path.join(
    destino,
    path.relative(origen, rutaOrigen)
  );

  fs.mkdirSync(path.dirname(rutaDestino), {
    recursive: true
  });

  fs.copyFileSync(rutaOrigen, rutaDestino);

  console.log(`✔ ${path.relative(origen, rutaOrigen)}`);
}

console.log("================================");
console.log("SINCRONIZACIÓN API CARTERA");
console.log("================================");

while (pendientes.length > 0) {
  sincronizar(pendientes.shift());
}

console.log(`\nArchivos sincronizados: ${procesados.size}`);
console.log("Sincronización finalizada.");
