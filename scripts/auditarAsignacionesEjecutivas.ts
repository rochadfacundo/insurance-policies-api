
import * as fs from "fs";
import * as path from "path";

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestoreEjecutivaRepository } from "../src/repositories/firestoreEjecutivaRepository";
import { Ejecutiva } from "../src/models/ejecutiva";
import { PAS, TipoGestionPAS } from "../src/models/pas";

interface RegistroImportacion {
  fila: number;
  pas: PAS;
  ejecutivoExcel: string | null;
}

interface ReporteImportacion {
  registros: RegistroImportacion[];
}

interface AsignacionPropuesta {
  productorId: string;
  productor: string;
  ejecutivoExcel: string | null;
  tipoGestion: TipoGestionPAS;
  ejecutivaId: string | null;
}

const ARCHIVO = path.resolve(
  __dirname,
  "resultado-importacion-pas.json"
);

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("AUDITORÍA ASIGNACIÓN EJECUTIVAS PAS");
  console.log("MODO SOLO LECTURA");
  console.log("========================================");

  if (!fs.existsSync(ARCHIVO)) {
    throw new Error("No se encontró el reporte de importación.");
  }

  const reporte = JSON.parse(
    fs.readFileSync(ARCHIVO, "utf8")
  ) as ReporteImportacion;

  const firestore = FirebaseConfig.getFirestore();

  const ejecutivaRepository = new FirestoreEjecutivaRepository();

  const ejecutivas = await ejecutivaRepository.obtenerTodas();

  const productoresSnapshot = await firestore
    .collection("productores")
    .get();

  console.log(`Ejecutivas encontradas: ${ejecutivas.length}`);
  console.log(`Productores en Firestore: ${productoresSnapshot.size}`);
  console.log(`Productores en JSON: ${reporte.registros.length}`);

  const productores = new Map(
    productoresSnapshot.docs.map(doc => [
      doc.id,
      doc.data() as PAS
    ])
  );

  const propuestas: AsignacionPropuesta[] = [];
  const errores: string[] = [];
  const advertencias: string[] = [];

  if (ejecutivas.length !== 8) {
    errores.push(
      `Se esperaban 8 ejecutivas, pero hay ${ejecutivas.length}.`
    );
  }

  if (productoresSnapshot.size !== 312) {
    errores.push(
      `Se esperaban 312 productores en Firestore.`
    );
  }

  if (reporte.registros.length !== 312) {
    errores.push(
      `Se esperaban 312 productores en el JSON.`
    );
  }

  const idsReporte = new Set(
    reporte.registros.map(registro => registro.pas.id)
  );

  if (idsReporte.size !== reporte.registros.length) {
    errores.push("Existen IDs duplicados en el JSON.");
  }

  for (const id of productores.keys()) {
    if (!idsReporte.has(id)) {
      errores.push(`Productor extra en Firestore: ${id}`);
    }
  }

  const ejecutivasPorApellido = new Map<string, Ejecutiva[]>();

  for (const ejecutiva of ejecutivas) {
    const apellido = normalizarTexto(ejecutiva.apellido);
    const existentes = ejecutivasPorApellido.get(apellido) ?? [];

    existentes.push(ejecutiva);
    ejecutivasPorApellido.set(apellido, existentes);
  }

  for (const registro of reporte.registros) {
    const pas = registro.pas;
    const existente = productores.get(pas.id);

    if (!existente) {
      errores.push(`Productor inexistente: ${pas.id}`);
      continue;
    }

    if (normalizarTexto(existente.nombre) !== normalizarTexto(pas.nombre)) {
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

    if (!tipoGestion) {
      errores.push(`Tipo de gestión ausente: ${pas.id}`);
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
          `No hay coincidencia única para "${registro.ejecutivoExcel}" (${pas.id}).`
        );
        continue;
      }

      const ejecutiva = coincidencias[0];

      if (!ejecutiva) {
        errores.push(`Ejecutiva no encontrada: ${pas.id}`);
        continue;
      }

      ejecutivaId = ejecutiva.id;

      if (!ejecutiva.activa) {
        advertencias.push(
          `Ejecutiva inactiva: ${ejecutiva.id} (${pas.id}).`
        );
      }
    } else if (
      tipoGestion !== "AUTOGESTIONADO" &&
      tipoGestion !== "SIN_ASIGNAR"
    ) {
      errores.push(`Tipo de gestión inválido: ${pas.id}`);
      continue;
    }

    if (
      existente.ejecutivaId &&
      existente.ejecutivaId !== ejecutivaId
    ) {
      errores.push(
        `Asignación existente diferente: ${pas.id} (${existente.ejecutivaId}).`
      );
      continue;
    }

    propuestas.push({
      productorId: pas.id,
      productor: pas.nombre,
      ejecutivoExcel: registro.ejecutivoExcel,
      tipoGestion,
      ejecutivaId
    });
  }

  console.log("\nDISTRIBUCIÓN PROPUESTA:");

  const distribucion: Record<string, number> = {};

  for (const propuesta of propuestas) {
    const clave = propuesta.tipoGestion;
    distribucion[clave] = (distribucion[clave] ?? 0) + 1;
  }

  console.table(distribucion);

  console.log("\nASIGNACIONES POR EJECUTIVA:");

  const porEjecutiva: Record<string, number> = {};

  for (const propuesta of propuestas) {
    if (!propuesta.ejecutivaId) continue;

    porEjecutiva[propuesta.ejecutivaId] =
      (porEjecutiva[propuesta.ejecutivaId] ?? 0) + 1;
  }

  console.table(porEjecutiva);

  console.log("\nRESUMEN:");

  console.table({
    productoresAuditados: reporte.registros.length,
    propuestasValidas: propuestas.length,
    errores: errores.length,
    advertencias: advertencias.length
  });

  if (errores.length > 0) {
    console.log("\nERRORES:");
    console.table(errores);
  }

  if (advertencias.length > 0) {
    console.log("\nADVERTENCIAS:");
    console.table(advertencias);
  }

  console.log("\nNo se realizaron escrituras en Firestore.");
}

main().catch(error => {
  console.error("Error durante la auditoría:", error);
  process.exitCode = 1;
});
