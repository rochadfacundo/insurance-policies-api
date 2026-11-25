
import dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";
import { MercantilCarteraService } from "../../src/companias/mercantil/services/mercantilCarteraService";

const POLIZAS_BUSCADAS = [
    517413151,
    191200107,
    181930203,
    181933711,
    64373146,
    91566730,
    517042777,
    516809023
];

async function main(): Promise<void> {

    const inicio = Date.now();

    const productores = obtenerProductoresMercantil();

    const service = new MercantilCarteraService();

    const pendientes = new Set(POLIZAS_BUSCADAS);

    const encontradas: {
        poliza: number;
        endoso: number;
        productor: number;
        nombreProductor: string;
        desde: string;
        hasta: string;
    }[] = [];

    const errores: Record<string, unknown>[] = [];

    let productoresConsultados = 0;

    console.log("\n======================================");
    console.log("BÚSQUEDA DE PÓLIZAS EN MERCANTIL");
    console.log("======================================");
    console.log(`Productores: ${productores.length}`);
    console.log(`Pólizas buscadas: ${pendientes.size}\n`);

    for (const productor of productores) {

        if (pendientes.size === 0) {
            break;
        }

        productoresConsultados++;

        console.log(
            `[${productoresConsultados}/${productores.length}] ` +
            `${productor.codigo} - ${productor.nombre} ` +
            `| Pendientes: ${pendientes.size}`
        );

        try {

            const cartera = await service.obtenerCarteraCompleta(
                productor.codigo
            );

            for (const numeroPoliza of pendientes) {

                const poliza = cartera.getPoliza(numeroPoliza);

                if (!poliza) {
                    continue;
                }

                encontradas.push({
                    poliza: poliza.poliza,
                    endoso: poliza.endoso,
                    productor: poliza.productor,
                    nombreProductor: poliza.nombreProductor,
                    desde: String(poliza.desde),
                    hasta: String(poliza.hasta)
                });

                pendientes.delete(numeroPoliza);

                console.log(
                    `ENCONTRADA: ${poliza.poliza} ` +
                    `| Endoso: ${poliza.endoso} ` +
                    `| Productor: ${poliza.productor}`
                );
            }

        } catch (error: unknown) {

            errores.push({
                productor: productor.codigo,
                nombre: productor.nombre,
                http: axios.isAxiosError(error)
                    ? error.response?.status
                    : undefined,
                mensaje: error instanceof Error
                    ? error.message
                    : String(error)
            });

            console.warn(
                `Error consultando productor ${productor.codigo}.`
            );
        }
    }

    console.log("\n======================================");
    console.log("RESULTADO DE LA BÚSQUEDA");
    console.log("======================================");

    console.log(`Productores consultados: ${productoresConsultados}`);
    console.log(`Productores con errores: ${errores.length}`);
    console.log(`Pólizas encontradas: ${encontradas.length}`);
    console.log(`Pólizas pendientes: ${pendientes.size}`);

    console.log("\nPÓLIZAS ENCONTRADAS:");

    console.table(encontradas);

    if (pendientes.size > 0) {

        console.log("\nPÓLIZAS NO LOCALIZADAS:");

        console.table(
            [...pendientes].map(poliza => ({ poliza }))
        );
    }

    if (errores.length > 0) {

        console.log("\nPRODUCTORES CON ERRORES:");

        console.table(errores);
    }

    console.log("\nCOMANDOS PARA AUDITAR TRANSFERENCIAS:\n");

    for (const resultado of encontradas) {

        console.log(
            `npx ts-node scripts/test-mercantil-transferencias.ts ` +
            `${resultado.poliza} ${resultado.endoso}`
        );
    }

    const duracion = (Date.now() - inicio) / 1000;

    console.log(`\nDuración: ${duracion.toFixed(2)} segundos.`);
    console.log("No se realizaron escrituras en Firestore.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
