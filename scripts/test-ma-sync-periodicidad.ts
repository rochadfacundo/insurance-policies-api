
import dotenv from "dotenv";
import path from "path";
import { PeriodicidadFacturacion } from "../src/models/periodicidadFacturacion";

dotenv.config({
    path: path.resolve(__dirname, "../.env.scripts.backup")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

async function main(): Promise<void> {

    const { obtenerProductoresMercantil } = await import(
        "../src/companias/mercantil/models/productoresMercantil"
    );

    const { MercantilCarteraService } = await import(
        "../src/companias/mercantil/services/mercantilCarteraService"
    );



    console.log("========================================");
    console.log("TEST PERIODICIDAD MERCANTIL - SOLO LECTURA");
    console.log("========================================");

    // ==========================================
    // 1. OBTENER PRODUCTORES ACTIVOS
    // ==========================================

    const productores = obtenerProductoresMercantil()
        .filter(productor => productor.estado_id === 1);

    console.log("Productores activos:", productores.length);

    // ==========================================
    // 2. SELECCIONAR PRODUCTOR
    // ==========================================

    // Ya verificamos que este productor tiene 10 pólizas.
    const CODIGO_PRODUCTOR = 12623;

    const productor = productores.find(
        productor => productor.codigo === CODIGO_PRODUCTOR
    );

    if (!productor) {
        throw new Error(
            `No se encontró el productor ${CODIGO_PRODUCTOR}`
        );
    }

    console.log("\nPRODUCTOR SELECCIONADO:");
    console.log(productor.codigo, productor.nombre);

    // ==========================================
    // 3. OBTENER CARTERA
    // ==========================================

    const carteraService = new MercantilCarteraService();

    const cartera = await carteraService.obtenerCarteraCompleta(
        productor.codigo
    );

    const polizas = cartera.getPolizas();

    console.log("\nPólizas vigentes:", polizas.length);

    if (polizas.length === 0) {
        console.log("El productor no tiene pólizas vigentes.");
        return;
    }

    // ==========================================
    // 4. ANALIZAR PERIODICIDAD
    // ==========================================

    const resultados: {
        poliza: number;
        endoso: number;
        periodicidad: PeriodicidadFacturacion | string;
        tipoFacturacion: string | undefined;
    }[] = [];

    let errores = 0;

    for (const item of polizas) {

        console.log(
            `\nAnalizando póliza ${item.poliza}, ` +
            `endoso ${item.endoso}...`
        );

        try {

            const detalleActual =
                await carteraService.obtenerDetallePoliza(
                    item.poliza,
                    item.endoso
                );

            const {
                detalleFacturacion,
                periodicidadFacturacion
            } = await carteraService.analizarFacturacion(
                item.poliza,
                item.endoso,
                detalleActual
            );

            resultados.push({
                poliza: item.poliza,
                endoso: item.endoso,
                periodicidad: periodicidadFacturacion,
                tipoFacturacion: detalleFacturacion.getTipo()
            });

        } catch (error) {

            errores++;

            console.error(
                `Error analizando póliza ${item.poliza}:`,
                error
            );
        }
    }

    // ==========================================
    // 5. RESUMEN
    // ==========================================

    const resumen = {
        totalCartera: polizas.length,
        analizadas: resultados.length,
        mensuales: resultados.filter(
            r => r.periodicidad === PeriodicidadFacturacion.MENSUAL
        ).length,
        noMensuales: resultados.filter(
            r => r.periodicidad === PeriodicidadFacturacion.NO_MENSUAL
        ).length,
        indeterminadas: resultados.filter(
            r => r.periodicidad === PeriodicidadFacturacion.INDETERMINADA
        ).length,
        errores
    };

    console.log("\n========================================");
    console.log("RESULTADOS DE PERIODICIDAD");
    console.log("========================================");

    console.table(resultados);

    console.log("\nRESUMEN:");
    console.table(resumen);

    // ==========================================
    // 6. VALIDACIONES
    // ==========================================

    if (errores > 0) {
        throw new Error(
            `La prueba finalizó con ${errores} errores.`
        );
    }

    if (resultados.length !== polizas.length) {
        throw new Error(
            "No se analizaron todas las pólizas."
        );
    }

    console.log("\n========================================");
    console.log("PRUEBA FINALIZADA CORRECTAMENTE");
    console.log("========================================");

    console.log("Pólizas analizadas:", resultados.length);
    console.log("No se llamó al repositorio de pólizas.");
}

main().catch(error => {
    console.error("\nError en la prueba:", error);
    process.exitCode = 1;
});
