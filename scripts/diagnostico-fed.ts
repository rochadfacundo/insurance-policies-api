
import dotenv from "dotenv";
import path from "path";
import * as admin from "firebase-admin";

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// false: simulación
// true: crear relaciones en Firestore
const GUARDAR_CAMBIOS = true;

interface ProductorPendiente {
    compania: string;
    codigo: number;
    nombre: string;
    matricula: number;
    ejecutivaId: string;
}

const PRODUCTORES: ProductorPendiente[] = [
    {
        compania: "FEDERACION PATRONAL",
        codigo: 23921,
        nombre: "TUROLLA GERARDO PABLO",
        matricula: 53375,
        ejecutivaId: "andrea-collia"
    },
    {
        compania: "MERCANTIL ANDINA",
        codigo: 91706,
        nombre: "Camporino Eduardo Mario",
        matricula: 93336,
        ejecutivaId: "andrea-collia"
    },
    {
        compania: "RIO URUGUAY",
        codigo: 7900,
        nombre: "Alfieri Emiliano Nahuel",
        matricula: 92331,
        ejecutivaId: "jessica-tassone"
    }
];

async function main(): Promise<void> {

    console.log("\n========================================");
    console.log("VINCULACIÓN DE PRODUCTORES FALTANTES");
    console.log("========================================");

    console.log(
        `Modo: ${GUARDAR_CAMBIOS ? "ESCRITURA" : "SIMULACIÓN"}`
    );

    let creados = 0;
    let existentes = 0;
    let preparados = 0;
    let errores = 0;

    for (const productor of PRODUCTORES) {

        const id = `${productor.compania}_${productor.codigo}`;

        console.log("\n----------------------------------------");
        console.log(`Documento: ${id}`);
        console.log(`Productor: ${productor.nombre}`);
        console.log(`Matrícula: ${productor.matricula}`);
        console.log(`Ejecutiva: ${productor.ejecutivaId}`);

        try {

            const ejecutivaDoc = await db
                .collection("ejecutivas")
                .doc(productor.ejecutivaId)
                .get();

            if (!ejecutivaDoc.exists) {
                errores++;
                console.log("ERROR: La ejecutiva no existe.");
                continue;
            }

            if (ejecutivaDoc.data()?.activa !== true) {
                errores++;
                console.log("ERROR: La ejecutiva no está activa.");
                continue;
            }

            const relacionRef = db
                .collection("productoresEjecutivas")
                .doc(id);

            const relacionDoc = await relacionRef.get();

            if (relacionDoc.exists) {
                existentes++;

                console.log("YA EXISTE. No se modifica.");
                console.log(
                    `Ejecutiva actual: ${relacionDoc.data()?.ejecutivaId}`
                );

                continue;
            }

            // Comprobar que el productor realmente tenga
            // pólizas con ese código y compañía.
            const polizasSnapshot = await db
                .collection("polizas")
                .where("compania", "==", productor.compania)
                .where("productor.codigo", "==", productor.codigo)
                .limit(1)
                .get();

            if (polizasSnapshot.empty) {
                errores++;
                console.log(
                    "ERROR: No se encontró una póliza " +
                    "con ese código y compañía."
                );
                continue;
            }

            const nombreEjecutiva = [
                ejecutivaDoc.data()?.nombre,
                ejecutivaDoc.data()?.apellido
            ].filter(Boolean).join(" ");

            console.log(`Ejecutiva confirmada: ${nombreEjecutiva}`);

            const datos = {
                compania: productor.compania,
                productor: {
                    codigo: productor.codigo,
                    nombre: productor.nombre,
                    matricula: productor.matricula
                },
                ejecutivaId: productor.ejecutivaId,
                fechaCreacion:
                    admin.firestore.FieldValue.serverTimestamp(),
                fechaActualizacion:
                    admin.firestore.FieldValue.serverTimestamp()
            };

            preparados++;

            if (!GUARDAR_CAMBIOS) {
                console.log("SIMULACIÓN: Relación preparada.");
                continue;
            }

            await relacionRef.create(datos);

            creados++;
            console.log("Relación creada correctamente.");

        } catch (error) {
            errores++;
            console.error(`ERROR procesando ${id}:`, error);
        }
    }

    console.log("\n========================================");
    console.log("RESUMEN");
    console.log("========================================");

    console.log(`Configurados: ${PRODUCTORES.length}`);
    console.log(`Preparados: ${preparados}`);
    console.log(`Existentes: ${existentes}`);
    console.log(`Creados: ${creados}`);
    console.log(`Errores: ${errores}`);

    if (!GUARDAR_CAMBIOS) {
        console.log("\nNo se modificó Firestore.");
    }
}

main()
    .then(() => {
        console.log("\nProceso finalizado.");
        process.exit(0);
    })
    .catch(error => {
        console.error("Error general:", error);
        process.exit(1);
    });
