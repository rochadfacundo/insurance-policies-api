
import dotenv from "dotenv";
import path from "path";

// ======================================================
// 1. CONFIGURACIÓN DE ENTORNO
// ======================================================

dotenv.config({
    path: path.resolve(__dirname, "../.env.scripts.backup")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

// ======================================================
// 2. AUDITORÍA DE RIESGOS GUARDADOS
// ======================================================

async function main(): Promise<void> {

    // Importaciones dinámicas para cargar primero el entorno.
    const { obtenerProductoresMercantil } = await import(
        "../src/companias/mercantil/models/productoresMercantil"
    );

    const { FirestorePolizaRepository } = await import(
        "../src/repositories/firestorePolizaRepository"
    );

    const { ECompania } = await import(
        "../src/models/eCompania"
    );

    const polizaRepository = new FirestorePolizaRepository();

    // --------------------------------------------------
    // 2.1. Obtener productores activos
    // --------------------------------------------------

    const productores = obtenerProductoresMercantil()
        .filter(productor => productor.estado_id === 1);

    console.log("\n==========================================");
    console.log("AUDITORÍA MERCANTIL - FIRESTORE");
    console.log("==========================================");
    console.log(`Productores activos: ${productores.length}`);

    // --------------------------------------------------
    // 2.2. Buscar un productor con riesgos
    // --------------------------------------------------

    for (const productor of productores) {

        const riesgosGuardados =
            await polizaRepository.obtenerPorProductor(
                productor.codigo,
                ECompania.MERCANTIL_ANDINA
            );

        if (riesgosGuardados.length === 0) {
            continue;
        }

        // --------------------------------------------------
        // 2.3. Mostrar información del productor
        // --------------------------------------------------

        console.log("\nPRODUCTOR ENCONTRADO");
        console.log("------------------------------------------");
        console.log(`Código: ${productor.codigo}`);
        console.log(`Nombre: ${productor.nombre}`);
        console.log(`Riesgos guardados: ${riesgosGuardados.length}`);

        // --------------------------------------------------
        // 2.4. Analizar periodicidad
        // --------------------------------------------------

        const conPeriodicidad = riesgosGuardados.filter(
            poliza => poliza.periodicidadFacturacion !== undefined
        ).length;

        const sinPeriodicidad =
            riesgosGuardados.length - conPeriodicidad;

        console.log("\nESTADO DE PERIODICIDAD");
        console.log("------------------------------------------");
        console.log(`Con periodicidad: ${conPeriodicidad}`);
        console.log(`Sin periodicidad: ${sinPeriodicidad}`);

        // --------------------------------------------------
        // 2.5. Mostrar pólizas
        // --------------------------------------------------

        console.table(
            riesgosGuardados.map(poliza => ({
                id: poliza.id,
                numeroPoliza: poliza.detallePoliza.numeroPoliza,
                periodicidad:
                    poliza.periodicidadFacturacion ?? "SIN CAMPO"
            }))
        );

        console.log("\nAuditoría finalizada.");
        console.log("No se realizaron escrituras en Firestore.");

        return;
    }

    console.log("\nNo se encontraron productores con riesgos guardados.");
    console.log("No se realizaron escrituras en Firestore.");
}

// ======================================================
// 3. EJECUCIÓN
// ======================================================

main()
    .then(() => {
        console.log("\nProceso finalizado.");
    })
    .catch((error: unknown) => {
        console.error("\nError durante la auditoría:", error);
        process.exitCode = 1;
    });
