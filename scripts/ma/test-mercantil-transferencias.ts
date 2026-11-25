
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({
    path: ".env.scripts.backup"
});

dotenv.config();

import { MercantilCarteraService } from "../../src/companias/mercantil/services/mercantilCarteraService";

async function main(): Promise<void> {

    const poliza = Number(process.argv[2]);
    const endosoActual = Number(process.argv[3]);

    if (
        !Number.isSafeInteger(poliza) ||
        poliza <= 0 ||
        !Number.isSafeInteger(endosoActual) ||
        endosoActual < 0
    ) {
        throw new Error(
            "Uso: indicar número de póliza y endoso actual."
        );
    }

    const service = new MercantilCarteraService();

    const resultados: Record<string, unknown>[] = [];

    console.log("\n======================================");
    console.log("AUDITORÍA TRANSFERENCIAS MERCANTIL");
    console.log("======================================");
    console.log(`Póliza: ${poliza}`);
    console.log(`Endoso actual: ${endosoActual}`);

    for (let endoso = endosoActual; endoso >= 0; endoso--) {

        console.log(`Consultando endoso ${endoso}...`);

        try {

            const detalle = await service.obtenerDetallePoliza(
                poliza,
                endoso
            );

            const modelo = detalle.getModel();

            resultados.push({
                endoso: detalle.getEndoso(),
                tipo: detalle.getTipo(),
                productor: detalle.getCodigoProductor(),
                desde: modelo.desde,
                hasta: modelo.hasta,
                prima: detalle.getPrima(),
                premio: detalle.getPremio(),
                cuotas: detalle.getCantidadCuotas(),
                factor: detalle.getFactorAnualizacion(),
                primaAnualizada: detalle.getPrimaAnualizada(),
                estado: "OK"
            });

        } catch (error: unknown) {

            resultados.push({
                endoso,
                estado: "ERROR",
                http: axios.isAxiosError(error)
                    ? error.response?.status
                    : undefined,
                mensaje: error instanceof Error
                    ? error.message
                    : String(error)
            });
        }
    }

    console.log("\n======================================");
    console.log("RESULTADOS");
    console.log("======================================");

    console.table(resultados);

    console.log("\nNo se realizaron escrituras en Firestore.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
