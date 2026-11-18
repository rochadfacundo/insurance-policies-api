
import * as fs from "fs";
import * as path from "path";

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestoreEjecutivaRepository } from "../src/repositories/firestoreEjecutivaRepository";
import { Ejecutiva } from "../src/models/ejecutiva";
import { PAS, TipoGestionPAS } from "../src/models/pas";

interface RegistroImportacion {
  pas: PAS;
  ejecutivoExcel: string | null;
}

interface ReporteImportacion {
  modo: string;
  resumen: {
    totalPAS: number;
  };
  registros: RegistroImportacion[];
}

interface CambioPropuesto {
  id: string;
  nombre: string;
  ejecutivaIdActual: string | null;
  ejecutivaIdNueva: string | null;
  tipoGestionActual: TipoGestionPAS | null;
  tipoGestionNuevo: TipoGestionPAS;
}

const ARCHIVO = path.resolve(
  __dirname,
  "resultado-importacion-pas.json"
);

const APLICAR = process.argv.includes("--aplicar");

const TOTAL_ESPERADO = 312;

const DISTRIBUCION_ESPERADA: Record<TipoGestionPAS, number> = {
  EJECUTIVA_ASIGNADA: 310,
  AUTOGESTIONADO: 1,
  SIN_ASIGNAR: 1
};

const ASIGNACIONES_ESPERADAS: Record<string, number> = {
  "andrea-collia": 76,
  "claudia-andrade": 68,
  "jessica-tassone": 53,
  "julieta-orsi": 50,
  "america-franze": 41,
  "sofia-ojeda": 22
};

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function contar<T extends string>(
  valores: T[]
): Record<string, number> {
  const resultado: Record<string, number> = {};

  for (const valor of valores) {
    resultado[valor] = (resultado[valor] ?? 0) + 1;
  }

  return resultado;
}

function verificarDistribucion(
  actual: Record<string, number>,
  esperada: Record<string, number>,
  descripcion: string,
  errores: string[]
): void {
  const claves = new Set([
    ...Object.keys(actual),
    ...Object.keys(esperada)
  ]);

  for (const clave of claves) {
    if ((actual[clave] ?? 0) !== (esperada[clave] ?? 0)) {
      errores.push(
        `${descripcion}: ${clave}, esperado ` +
        `${esperada[clave] ?? 0}, obtenido ${actual[clave] ?? 0}`
      );
    }
  }
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("ASIGNACIÓN DE EJECUTIVAS A PRODUCTORES");
  console.log(APLICAR ? "MODO APLICAR" : "MODO SIMULACIÓN");
  console.log("========================================");

  if (!fs.existsSync(ARCHIVO)) {
    throw new Error("No existe el reporte de importación.");
  }

  const reporte = JSON.parse(
    fs.readFileSync(ARCHIVO, "utf8")
  ) as ReporteImportacion;

  if (
    reporte.modo !== "DRY_RUN" ||
    reporte.resumen.totalPAS !== TOTAL_ESPERADO ||
    reporte.registros.length !== TOTAL_ESPERADO
  ) {
    throw new Error(
      "El reporte no corresponde a la simulación auditada de 312 PAS."
    );
  }

  const firestore = FirebaseConfig.getFirestore();
  const ejecutivaRepository = new FirestoreEjecutivaRepository();

  const [ejecutivas, snapshot] = await Promise.all([
    ejecutivaRepository.obtenerTodas(),
    firestore.collection("productores").get()
  ]);

  const errores: string[] = [];
  const cambios: CambioPropuesto[] = [];

  if (ejecutivas.length !== 8) {
    errores.push(`Se esperaban 8 ejecutivas; hay ${ejecutivas.length}.`);
  }

  if (snapshot.size !== TOTAL_ESPERADO) {
    errores.push(
      `Se esperaban 312 productores; hay ${snapshot.size}.`
    );
  }

  const productores = new Map(
    snapshot.docs.map(doc => [doc.id, doc.data() as PAS])
  );

  const ejecutivasPorApellido = new Map<string, Ejecutiva[]>();

  for (const ejecutiva of ejecutivas) {
    const apellido = normalizarTexto(ejecutiva.apellido);
    const lista = ejecutivasPorApellido.get(apellido) ?? [];

    lista.push(ejecutiva);
    ejecutivasPorApellido.set(apellido, lista);
  }

  const idsJSON = new Set<string>();
  const tipos: TipoGestionPAS[] = [];
  const asignaciones: string[] = [];

  for (const registro of reporte.registros) {
    const pas = registro.pas;

    if (idsJSON.has(pas.id)) {
      errores.push(`ID duplicado en JSON: ${pas.id}`);
      continue;
    }

    idsJSON.add(pas.id);

    const existente = productores.get(pas.id);

    if (!existente) {
      errores.push(`No existe en Firestore: ${pas.id}`);
      continue;
    }

    if (
      normalizarTexto(existente.nombre) !==
      normalizarTexto(pas.nombre)
    ) {
      errores.push(`Nombre diferente: ${pas.id}`);
      continue;
    }

    if (existente.matricula !== pas.matricula) {
      errores.push(`Matrícula diferente: ${pas.id}`);
      continue;
    }

    if (existente.filaOrigen !== pas.filaOrigen) {
      errores.push(`Fila de origen diferente: ${pas.id}`);
      continue;
    }

    const tipoGestion = pas.tipoGestion;

    if (
      tipoGestion !== "EJECUTIVA_ASIGNADA" &&
      tipoGestion !== "AUTOGESTIONADO" &&
      tipoGestion !== "SIN_ASIGNAR"
    ) {
      errores.push(`Tipo de gestión inválido: ${pas.id}`);
      continue;
    }

    let ejecutivaId: string | null = null;

    if (tipoGestion === "EJECUTIVA_ASIGNADA") {
      if (!registro.ejecutivoExcel) {
        errores.push(`Ejecutiva ausente: ${pas.id}`);
        continue;
      }

      const apellido = normalizarTexto(registro.ejecutivoExcel);
      const coincidencias = ejecutivasPorApellido.get(apellido) ?? [];

      if (coincidencias.length !== 1) {
        errores.push(
          `Ejecutiva no encontrada o ambigua: ${pas.id} (${apellido})`
        );
        continue;
      }

      const ejecutiva = coincidencias[0];

      if (!ejecutiva || !ejecutiva.activa) {
        errores.push(`Ejecutiva inexistente o inactiva: ${pas.id}`);
        continue;
      }

      ejecutivaId = ejecutiva.id;
      asignaciones.push(ejecutivaId);
    } else if (tipoGestion === "AUTOGESTIONADO") {
      if (normalizarTexto(registro.ejecutivoExcel ?? "") !== "DEMARCHI") {
        errores.push(`Autogestionado inesperado: ${pas.id}`);
        continue;
      }
    } else if (registro.ejecutivoExcel) {
      errores.push(`SIN_ASIGNAR con ejecutivo: ${pas.id}`);
      continue;
    }

    tipos.push(tipoGestion);

    const ejecutivaActual = existente.ejecutivaId ?? null;
    const tipoActual = existente.tipoGestion ?? null;

    // Nunca sobrescribir una asignación diferente ya existente.
    if (
      ejecutivaActual !== null &&
      ejecutivaActual !== ejecutivaId
    ) {
      errores.push(
        `Conflicto de ejecutiva: ${pas.id} (${ejecutivaActual})`
      );
      continue;
    }

    if (
      tipoActual !== null &&
      tipoActual !== tipoGestion
    ) {
      errores.push(
        `Conflicto de tipo de gestión: ${pas.id} (${tipoActual})`
      );
      continue;
    }

    if (
      ejecutivaActual !== ejecutivaId ||
      tipoActual !== tipoGestion
    ) {
      cambios.push({
        id: pas.id,
        nombre: pas.nombre,
        ejecutivaIdActual: ejecutivaActual,
        ejecutivaIdNueva: ejecutivaId,
        tipoGestionActual: tipoActual,
        tipoGestionNuevo: tipoGestion
      });
    }
  }

  for (const id of productores.keys()) {
    if (!idsJSON.has(id)) {
      errores.push(`Productor extra en Firestore: ${id}`);
    }
  }

  verificarDistribucion(
    contar(tipos),
    DISTRIBUCION_ESPERADA,
    "Distribución de tipos",
    errores
  );

  verificarDistribucion(
    contar(asignaciones),
    ASIGNACIONES_ESPERADAS,
    "Asignaciones por ejecutiva",
    errores
  );

  console.log("\nTIPOS DE GESTIÓN:");
  console.table(contar(tipos));

  console.log("\nASIGNACIONES POR EJECUTIVA:");
  console.table(contar(asignaciones));

  console.log("\nRESUMEN:");
  console.table({
    productoresJSON: reporte.registros.length,
    productoresFirestore: snapshot.size,
    cambiosNecesarios: cambios.length,
    sinCambios: TOTAL_ESPERADO - cambios.length,
    errores: errores.length
  });

  if (errores.length > 0) {
    console.log("\nERRORES:");
    console.table(errores);

    throw new Error(
      "Auditoría fallida. No se realizaron escrituras."
    );
  }

  console.log("\nPRIMEROS 15 CAMBIOS:");
  console.table(cambios.slice(0, 15));

  if (!APLICAR) {
    console.log("\nSIMULACIÓN FINALIZADA.");
    console.log("No se realizaron escrituras en Firestore.");
    return;
  }

  // Las escrituras se ejecutan solamente con --aplicar.
  // Se actualizan únicamente los dos campos previstos.
  // Cada transacción comprueba que los datos no hayan cambiado
  // desde la lectura inicial.

  let actualizados = 0;

  for (const cambio of cambios) {
    const referencia = firestore
      .collection("productores")
      .doc(cambio.id);

    await firestore.runTransaction(async transaction => {
      const documento = await transaction.get(referencia);

      if (!documento.exists) {
        throw new Error(`Productor eliminado: ${cambio.id}`);
      }

      const actual = documento.data() as PAS;

      if (
        normalizarTexto(actual.nombre) !==
          normalizarTexto(cambio.nombre) ||
        (actual.ejecutivaId ?? null) !==
          cambio.ejecutivaIdActual ||
        (actual.tipoGestion ?? null) !==
          cambio.tipoGestionActual
      ) {
        throw new Error(
          `El productor cambió durante la ejecución: ${cambio.id}`
        );
      }

      transaction.update(referencia, {
        ejecutivaId: cambio.ejecutivaIdNueva,
        tipoGestion: cambio.tipoGestionNuevo
      });
    });

    actualizados++;
  }

  console.log("\nACTUALIZACIÓN FINALIZADA.");
  console.log(`Productores actualizados: ${actualizados}`);
  console.log("Colección modificada: productores");
  console.log("Campos modificados: ejecutivaId, tipoGestion");
}

main().catch(error => {
  console.error("\nERROR:", error);
  process.exitCode = 1;
});
