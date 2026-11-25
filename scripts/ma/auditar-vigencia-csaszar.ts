import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { MercantilCarteraService } from "../../src/companias/mercantil/services/mercantilCarteraService";

const PRODUCTOR = 86404;

const POLIZAS = [
    131866854,
    131868727,
    131755162,
    131789373
];

async function main(): Promise<void> {

    const service = new MercantilCarteraService();

    console.log("\n======================================");
    console.log("AUDITORÍA DE VIGENCIA - CSASZAR");
    console.log("======================================");

    console.log(`Productor: ${PRODUCTOR}`);

    const cartera = await service.obtenerCarteraCompleta(
        PRODUCTOR
    );

    // Inspeccionar la estructura del manager de cartera.
    console.log("\nCARTERA DEVUELTA:");

    console.dir(cartera, {
        depth: null,
        maxArrayLength: null
    });

    // ==========================================
    // CONSULTAR DETALLES INDIVIDUALES
    // ==========================================

    const casos = [
        { poliza: 131866854, endoso: 0 },
        { poliza: 131868727, endoso: 0 },
        { poliza: 131755162, endoso: 32 },
        { poliza: 131789373, endoso: 24 }
    ];

    for (const caso of casos) {

        console.log("\n======================================");

        console.log(
            `PÓLIZA ${caso.poliza} - ENDOSO ${caso.endoso}`
        );

        console.log("======================================");

        try {

            const detalle = await service.obtenerDetallePoliza(
                caso.poliza,
                caso.endoso
            );

            console.log("\nDATOS GENERALES:");

            console.log({
                poliza: detalle.getPoliza(),
                endoso: detalle.getEndoso(),
                ramo: detalle.getRamaNombre(),
                codigoRamo: detalle.getRamaId(),
                tipoEndoso: detalle.getTipo(),
                periodo: detalle.getPeriodo(),
                prima: detalle.getPrima(),
                premio: detalle.getPremio()
            });

            console.log("\nMODELO COMPLETO:");

            console.dir(detalle.getModel(), {
                depth: null,
                maxArrayLength: null
            });

        } catch (error) {

            console.error(
                `Error consultando póliza ${caso.poliza}:`,
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    console.log("\n======================================");
    console.log("AUDITORÍA FINALIZADA");
    console.log("======================================");

    console.log("No se realizaron escrituras en Firestore.");
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});