
import dotenv from "dotenv";
import * as admin from "firebase-admin";
import path from "path";

dotenv.config({ path: "../.env" });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            path.resolve(__dirname, "../src/credentials/firebase-admin.json")
        )
    });
}

const db = admin.firestore();

const COMPANIA = "MERCANTIL ANDINA";
const CODIGO_PRODUCTOR = "86322";
const NOMBRE_NUEVO = "Horacio Rocha";

const APLICAR = process.argv.includes("--aplicar");

async function main(): Promise<void> {

    console.log("========================================");
    console.log("CORRECCIÓN PRODUCTOR MERCANTIL ANDINA");
    console.log("========================================");

    console.log(`Compañía: ${COMPANIA}`);
    console.log(`Código PAS: ${CODIGO_PRODUCTOR}`);
    console.log(`Nombre nuevo: ${NOMBRE_NUEVO}`);
    console.log(`Modo: ${APLICAR ? "APLICAR" : "PREVIEW"}`);

    // Buscamos todas las pólizas de Mercantil Andina.
    const snapshot = await db
        .collection("polizas")
        .where("compania", "==", COMPANIA)
        .get();

    const coincidencias = snapshot.docs.filter(doc => {
        const datos = doc.data();

        return String(datos.productor?.codigo) === CODIGO_PRODUCTOR;
    });

    console.log("");
    console.log(`Pólizas encontradas: ${coincidencias.length}`);

    if (coincidencias.length === 0) {
        console.log("No se encontraron pólizas para modificar.");
        return;
    }

    let pendientes = 0;
    let actualizadas = 0;

    for (const documento of coincidencias) {

        const datos = documento.data();
        const nombreActual = datos.productor?.nombre;

        console.log("");
        console.log(`Documento: ${documento.id}`);
        console.log(
            `Póliza: ${datos.detallePoliza?.numeroPoliza ?? "-"}`
        );
        console.log(`Nombre actual: ${nombreActual}`);
        console.log(`Nombre nuevo: ${NOMBRE_NUEVO}`);

        if (nombreActual === NOMBRE_NUEVO) {
            console.log("✓ Ya tiene el nombre correcto.");
            continue;
        }

        pendientes++;

        if (!APLICAR) {
            console.log("PREVIEW: se actualizaría productor.nombre");
            continue;
        }

        // Actualizamos únicamente el nombre del productor.
        await documento.ref.update({
            "productor.nombre": NOMBRE_NUEVO
        });

        actualizadas++;

        console.log("✓ Nombre actualizado.");
    }

    console.log("");
    console.log("========================================");
    console.log("RESUMEN");
    console.log("========================================");

    console.log(`Pólizas encontradas: ${coincidencias.length}`);
    console.log(`Pólizas pendientes: ${pendientes}`);
    console.log(`Pólizas actualizadas: ${actualizadas}`);

    if (!APLICAR) {
        console.log("PREVIEW: no se realizaron escrituras.");
    }
}

main()
    .then(() => {
        console.log("");
        console.log("Proceso finalizado.");
        process.exit(0);
    })
    .catch(error => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
