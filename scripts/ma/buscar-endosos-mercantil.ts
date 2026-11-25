import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../../src/config/firebaseConfig";

const POLIZAS = [
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

    const firestore = FirebaseConfig.getFirestore();

    const resultados: Record<string, unknown>[] = [];

    console.log("\n======================================");
    console.log("BÚSQUEDA DE ENDOSOS MERCANTIL");
    console.log("======================================\n");

    for (const poliza of POLIZAS) {

        const id = `MERCANTIL_${poliza}`;

        const documento = await firestore
            .collection("polizas")
            .doc(id)
            .get();

        if (!documento.exists) {

            resultados.push({
                poliza,
                estado: "NO ENCONTRADA"
            });

            continue;
        }

        const datos = documento.data();

        resultados.push({
            poliza,
            endoso: datos?.detallePoliza?.endoso ?? "SIN DATO",
            productor: datos?.productor?.codigo ?? "SIN DATO",
            periodicidad:
                datos?.detallePoliza?.periodicidadFacturacion ??
                "SIN DATO",
            estado: "ENCONTRADA"
        });
    }

    console.table(resultados);

    console.log("\nCOMANDOS PARA AUDITAR TRANSFERENCIAS:\n");

    for (const resultado of resultados) {

        if (
            resultado.estado === "ENCONTRADA" &&
            typeof resultado.endoso === "number"
        ) {
            console.log(
                `npx ts-node scripts/test-mercantil-transferencias.ts ` +
                `${resultado.poliza} ${resultado.endoso}`
            );
        }
    }

    console.log("\nNo se realizaron escrituras en Firestore.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});