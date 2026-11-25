import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { MercantilCarteraService } from "../../src/companias/mercantil/services/mercantilCarteraService";

// ======================================================
// 1. PÓLIZAS DE PRUEBA
// ======================================================

const polizas = [
    { poliza: 517413151, endoso: 2 },
    { poliza: 191200107, endoso: 1 },
    { poliza: 181930203, endoso: 2 },
    { poliza: 181933711, endoso: 1 },
    { poliza: 64373146, endoso: 17 },
    { poliza: 91566730, endoso: 1 },
    { poliza: 517042777, endoso: 5 },
    { poliza: 516809023, endoso: 8 }
];

// ======================================================
// 2. PROCESO PRINCIPAL
// ======================================================

async function main(): Promise<void> {

    const inicio = Date.now();

    const service = new MercantilCarteraService();

    const resultados = [];

    let procesadas = 0;
    let conInformacionEconomica = 0;
    let sinInformacionEconomica = 0;
    let errores = 0;

    console.log("\n======================================");
    console.log("TEST FACTURACIÓN CARTERA MERCANTIL");
    console.log("======================================");

    for (const { poliza, endoso } of polizas) {

        console.log(
            `\nProcesando póliza ${poliza}, endoso ${endoso}...`
        );

        try {

            const detalleActual =
                await service.obtenerDetallePoliza(poliza, endoso);

            const resultado =
                await service.analizarFacturacionCartera(
                    poliza,
                    endoso,
                    detalleActual
                );

            const detalle = resultado.detalleFacturacion;

            const primaAnualizada =
                detalle?.getPrimaAnualizada() ?? null;

            const premioAnualizado =
                detalle?.getPremioAnualizado() ?? null;

            resultados.push({
                poliza,
                endoso,
                tipoActual: detalleActual.getTipo(),
                transferencia: resultado.transferenciaDetectada,
                historialRestringido: resultado.historialRestringido,
                endosoEconomico: detalle?.getEndoso() ?? null,
                tipoEconomico: detalle?.getTipo() ?? null,
                primaAnualizada,
                premioAnualizado,
                periodicidad: resultado.periodicidadFacturacion,
                estado: "OK"
            });

            procesadas++;

            if (detalle) {
                conInformacionEconomica++;
            } else {
                sinInformacionEconomica++;
            }

        } catch (error: unknown) {

            errores++;

            const mensaje = error instanceof Error
                ? error.message
                : String(error);

            console.error(
                `Error procesando póliza ${poliza}: ${mensaje}`
            );

            resultados.push({
                poliza,
                endoso,
                estado: "ERROR",
                mensaje
            });
        }
    }

    // ==================================================
    // 3. RESULTADOS
    // ==================================================

    console.log("\n======================================");
    console.log("RESULTADOS");
    console.log("======================================");

    console.table(resultados);

    console.log("\nRESUMEN:");

    console.log({
        total: polizas.length,
        procesadas,
        conInformacionEconomica,
        sinInformacionEconomica,
        errores
    });

    console.log(
        `\nDuración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("No se realizaron escrituras en Firestore.");

    if (errores > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});