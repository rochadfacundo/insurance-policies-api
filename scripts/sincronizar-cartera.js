
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const origen = path.resolve(__dirname, "../lib");
const destino = path.resolve(__dirname, "../functions-cartera/lib");

const limpiar = process.argv.includes("--clean");

const pendientes = ["index.js"];
const procesados = new Set();
const dependenciasDinamicas = [];

// Archivos adicionales que se cargan dinámicamente.
// Agregar rutas relativas a lib cuando sea necesario.
const archivosAdicionales = [];

function dentroDe(directorio, archivo) {
  return archivo.startsWith(directorio + path.sep);
}

function recorrer(archivo) {
  const rutaOrigen = path.resolve(origen, archivo);

  if (!dentroDe(origen, rutaOrigen)) {
    throw new Error(`Ruta fuera de lib: ${archivo}`);
  }

  if (procesados.has(rutaOrigen)) return;

  if (!fs.existsSync(rutaOrigen)) {
    throw new Error(`Archivo faltante: ${rutaOrigen}`);
  }

  procesados.add(rutaOrigen);

  if (path.extname(rutaOrigen) !== ".js") return;

  const contenido = fs.readFileSync(rutaOrigen, "utf8");
  const resolver = createRequire(rutaOrigen);

  // Imports estáticos CommonJS.
  const expresion = /require\(\s*["']([^"']+)["']\s*\)/g;

  for (const coincidencia of contenido.matchAll(expresion)) {
    const modulo = coincidencia[1];

    if (!modulo.startsWith(".")) continue;

    const dependencia = resolver.resolve(modulo);

    if (!dentroDe(origen, dependencia)) {
      throw new Error(
        `Dependencia local fuera de lib: ${modulo}`
      );
    }

    pendientes.push(path.relative(origen, dependencia));
  }

  // Advertir sobre require() no literales.
  const expresionDinamica = /require\(\s*(?!["'])[^)]+\)/g;

  for (const coincidencia of contenido.matchAll(expresionDinamica)) {
    dependenciasDinamicas.push({
      archivo: path.relative(origen, rutaOrigen),
      expresion: coincidencia[0]
    });
  }
}

function listarArchivos(directorio) {
  if (!fs.existsSync(directorio)) return [];

  const archivos = [];

  function recorrerDirectorio(actual) {
    for (const entrada of fs.readdirSync(actual, {
      withFileTypes: true
    })) {
      const ruta = path.join(actual, entrada.name);

      if (entrada.isDirectory()) {
        recorrerDirectorio(ruta);
      } else if (entrada.isFile()) {
        archivos.push(ruta);
      }
    }
  }

  recorrerDirectorio(directorio);
  return archivos;
}

console.log("================================");
console.log("SINCRONIZACIÓN API CARTERA");
console.log("================================");

for (const archivo of archivosAdicionales) {
  pendientes.push(archivo);
}

// 1. Descubrir todas las dependencias antes de modificar destino.
while (pendientes.length > 0) {
  recorrer(pendientes.shift());
}

// 2. Detectar archivos obsoletos.
const necesarios = new Set(
  [...procesados].map(archivo =>
    path.relative(origen, archivo)
  )
);

const obsoletos = listarArchivos(destino)
  .filter(archivo => [".js", ".json"].includes(path.extname(archivo)))
  .filter(archivo =>
    !necesarios.has(path.relative(destino, archivo))
  );

console.log(`Dependencias necesarias: ${necesarios.size}`);

if (dependenciasDinamicas.length > 0) {
  console.log("\n⚠ Posibles dependencias dinámicas:");

  for (const item of dependenciasDinamicas) {
    console.log(`  ${item.archivo}: ${item.expresion}`);
  }

  if (limpiar) {
    throw new Error(
      "Limpieza cancelada: revisar dependencias dinámicas."
    );
  }
}

if (obsoletos.length > 0) {
  console.log("\nArchivos potencialmente obsoletos:");

  for (const archivo of obsoletos) {
    console.log(`  ${path.relative(destino, archivo)}`);
  }
} else {
  console.log("No se detectaron archivos obsoletos.");
}

// 3. Sincronizar archivos necesarios.
for (const archivo of procesados) {
  const relativa = path.relative(origen, archivo);
  const rutaDestino = path.join(destino, relativa);

  fs.mkdirSync(path.dirname(rutaDestino), {
    recursive: true
  });

  fs.copyFileSync(archivo, rutaDestino);

  console.log(`✔ ${relativa}`);
}

// 4. Limpiar únicamente si se solicitó.
if (limpiar) {
  for (const archivo of obsoletos) {
    fs.unlinkSync(archivo);
    console.log(`🗑 Eliminado: ${path.relative(destino, archivo)}`);
  }
} else if (obsoletos.length > 0) {
  console.log(
    "\nPara eliminar los archivos obsoletos, usar --clean."
  );
}

console.log("\nSincronización finalizada.");
