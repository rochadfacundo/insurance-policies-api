import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../../src/config/firebaseConfig";
import { MercantilCarteraService } from "../../src/companias/mercantil/services/mercantilCarteraService";
import { ECompania } from "../../src/models/eCompania";
import { Poliza } from "../../src/models/poliza";
import { PeriodicidadFacturacion } from "../../src/models/periodicidadFacturacion";

async function main(): Promise<void> {

    const inicio = Date.now();

    const firestore = FirebaseConfig.getFirestore();

    const service = new MercantilCarteraService();

    console.log("\n======================================");
    console.log("TEST FACTURACIÓN MERCANTIL NORMAL");
    console.log("======================================");

    const snapshot = await firestore
        .collection("polizas")
        .where("compania", "==", ECompania.MERCANTIL_ANDINA)
        .get();

    const polizas = snapshot.docs.map(
        doc => doc.data() as Poliza
    );

    console.log(`Pólizas Mercantil encontradas: ${polizas.length}`);

    // ==================================================
    // 1. SELECCIÓN DE CASOS
    // ==================================================

    const mensuales = polizas.filter(
        p =>
            p.periodicidadFacturacion ===
            PeriodicidadFacturacion.MENSUAL &&
            (p.detallePoliza.endoso ?? 0) > 0
    ).slice(0, 3);

    const noMensuales = polizas.filter(
        p =>
            p.periodicidadFacturacion ===
            PeriodicidadFacturacion.NO_MENSUAL &&
            (p.detallePoliza.endoso ?? 0) > 0
    ).slice(0, 3);

    const endosoCero = polizas.filter(
        p => p.detallePoliza.endoso === 0
    ).slice(0, 3);

    const casos = [
        ...mensuales.map(poliza => ({
            poliza,
            escenario: "MENSUAL"
        })),
        ...noMensuales.map(poliza => ({
            poliza,
            escenario: "NO_MENSUAL"
        })),
        ...endosoCero.map(poliza => ({
            poliza,
            escenario: "ENDOSO_CERO"
        }))
    ];

    console.log("\nCASOS SELECCIONADOS:");

    console.log({
        mensuales: mensuales.length,
        noMensuales: noMensuales.length,
        endosoCero: endosoCero.length,
        total: casos.length
    });

    const resultados = [];

    let correctas = 0;
    let diferencias = 0;
    let errores = 0;

    // ==================================================
    // 2. COMPARACIÓN DE AMBOS MÉTODOS
    // ==================================================

    for (const caso of casos) {

        const numeroPoliza =
            caso.poliza.detallePoliza.numeroPoliza;

        const endoso =
            caso.poliza.detallePoliza.endoso!;

        console.log(
            `\nProcesando ${numeroPoliza} - ` +
            `Endoso ${endoso} - ${caso.escenario}`
        );

        try {

            const detalleActual =
                await service.obtenerDetallePoliza(
                    numeroPoliza,
                    endoso
                );

            // Método utilizado actualmente por riesgos.
            const anterior =
                await service.analizarFacturacion(
                    numeroPoliza,
                    endoso,
                    detalleActual
                );

            // Nuevo método de cartera.
            const nuevo =
                await service.analizarFacturacionCartera(
                    numeroPoliza,
                    endoso,
                    detalleActual
                );

            const primaAnterior =
                anterior.detalleFacturacion.getPrimaAnualizada();

            const primaNueva =
                nuevo.detalleFacturacion?.getPrimaAnualizada()
                ?? null;

            const premioAnterior =
                anterior.detalleFacturacion.getPremioAnualizado();

            const premioNuevo =
                nuevo.detalleFacturacion?.getPremioAnualizado()
                ?? null;

            const mismoEndoso =
                anterior.detalleFacturacion.getEndoso() ===
                nuevo.detalleFacturacion?.getEndoso();

            const mismaPrima =
                primaNueva !== null &&
                Math.abs(primaAnterior - primaNueva) < 0.01;

            const mismoPremio =
                premioNuevo !== null &&
                Math.abs(premioAnterior - premioNuevo) < 0.01;

            const mismaPeriodicidad =
                anterior.periodicidadFacturacion ===
                nuevo.periodicidadFacturacion;

            const coincide =
                mismoEndoso &&
                mismaPrima &&
                mismoPremio &&
                mismaPeriodicidad;

            if (coincide) {
                correctas++;
            } else {
                diferencias++;
            }

            resultados.push({
                poliza: numeroPoliza,
                endoso,
                escenario: caso.escenario,
                endosoAnterior:
                    anterior.detalleFacturacion.getEndoso(),
                endosoNuevo:
                    nuevo.detalleFacturacion?.getEndoso() ?? null,
                primaAnterior: Number(primaAnterior.toFixed(2)),
                primaNueva: primaNueva !== null
                    ? Number(primaNueva.toFixed(2))
                    : null,
                mismoPremio,
                periodicidadAnterior:
                    anterior.periodicidadFacturacion,
                periodicidadNueva:
                    nuevo.periodicidadFacturacion,
                transferencia: nuevo.transferenciaDetectada,
                historialRestringido: nuevo.historialRestringido,
                estado: coincide ? "OK" : "DIFERENCIA"
            });

        } catch (error: unknown) {

            errores++;

            const mensaje = error instanceof Error
                ? error.message
                : String(error);

            console.error(mensaje);

            resultados.push({
                poliza: numeroPoliza,
                endoso,
                escenario: caso.escenario,
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
        total: casos.length,
        correctas,
        diferencias,
        errores
    });

    console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("No se realizaron escrituras en Firestore.");

    if (
        errores > 0 ||
        diferencias > 0 ||
        casos.length === 0
    ) {
        process.exitCode = 1;
    }
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});