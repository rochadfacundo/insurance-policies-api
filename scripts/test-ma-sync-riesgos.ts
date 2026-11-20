
import dotenv from "dotenv";
import path from "path";

// ======================================================
// 1. CONFIGURACIÓN
// ======================================================

dotenv.config({
    path: path.resolve(__dirname, "../.env.scripts.backup")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

// ======================================================
// 2. TEST DE SINCRONIZACIÓN - SOLO LECTURA
// ======================================================

async function main(): Promise<void> {

    const { obtenerProductoresMercantil } = await import(
        "../src/companias/mercantil/models/productoresMercantil"
    );

    const { MercantilSyncService } = await import(
        "../src/companias/mercantil/services/mercantilSyncService"
    );

    const { FirestorePolizaRepository } = await import(
        "../src/repositories/firestorePolizaRepository"
    );

    const { ECompania } = await import(
        "../src/models/eCompania"
    );

    const CODIGO_PRODUCTOR = 16592;

    const productor = obtenerProductoresMercantil().find(
        p => p.codigo === CODIGO_PRODUCTOR
    );

    if (!productor) {
        throw new Error("Productor no encontrado.");
    }

    const syncService = new MercantilSyncService();
    const repository = new FirestorePolizaRepository();

    console.log("\n==========================================");
    console.log("TEST SINCRONIZACIÓN MERCANTIL");
    console.log("SOLO LECTURA - SIN ESCRITURAS");
    console.log("==========================================");
    console.log("Productor:", productor.codigo, productor.nombre);

    // --------------------------------------------------
    // 2.1. Obtener riesgos guardados
    // --------------------------------------------------

    const guardados = await repository.obtenerPorProductor(
        productor.codigo,
        ECompania.MERCANTIL_ANDINA
    );

    console.log("Riesgos guardados:", guardados.length);

    // --------------------------------------------------
    // 2.2. Consultar Mercantil sin guardar errores
    // --------------------------------------------------

    const actuales = await syncService.sincronizar(
        productor,
        false
    );

    console.log("Riesgos actuales:", actuales.length);

    // --------------------------------------------------
    // 2.3. Comparar riesgos
    // --------------------------------------------------

    const idsGuardados = new Set(
        guardados.map(p => p.id)
    );

    const idsActuales = new Set(
        actuales.map(p => p.id)
    );

    const nuevos = actuales.filter(
        p => !idsGuardados.has(p.id)
    );

    const desaparecidos = guardados.filter(
        p => !idsActuales.has(p.id)
    );

    console.log("\nCOMPARACIÓN");
    console.log("------------------------------------------");
    console.log("Guardados:", guardados.length);
    console.log("Actuales:", actuales.length);
    console.log("Nuevos:", nuevos.length);
    console.log("Desaparecidos:", desaparecidos.length);

    // --------------------------------------------------
    // 2.4. Verificar periodicidad
    // --------------------------------------------------

    console.log("\nPERIODICIDAD CALCULADA");

    console.table(
        actuales.map(p => ({
            numeroPoliza: p.detallePoliza.numeroPoliza,
            periodicidad:
                p.periodicidadFacturacion ?? "SIN CAMPO",
            riesgos: p.riesgos.length
        }))
    );

    if (desaparecidos.length > 0) {
        console.log("\nATENCIÓN: riesgos que desaparecerían:");
        console.table(
            desaparecidos.map(p => ({
                id: p.id,
                numeroPoliza: p.detallePoliza.numeroPoliza
            }))
        );
    }

    if (nuevos.length > 0) {
        console.log("\nRiesgos nuevos:");
        console.table(
            nuevos.map(p => ({
                id: p.id,
                numeroPoliza: p.detallePoliza.numeroPoliza
            }))
        );
    }

    console.log("\nTest finalizado.");
    console.log("No se realizaron escrituras en Firestore.");
}

// ======================================================
// 3. EJECUCIÓN
// ======================================================

main().catch((error: unknown) => {
    console.error("\nError durante el test:", error);
    process.exitCode = 1;
});
