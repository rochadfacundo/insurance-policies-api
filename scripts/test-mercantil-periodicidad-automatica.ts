import dotenv from "dotenv";
import { MercantilCarteraService } from "../src/companias/mercantil/services/mercantilCarteraService";

dotenv.config({ path: "../.env.scripts.backup" });

async function main() {

    const service = new MercantilCarteraService();

    // Casos que auditamos anteriormente.
    const polizas = [
        { numero: 516817869, endoso: 0 },
        { numero: 191197309, endoso: 0 },
        { numero: 517370668, endoso: 0 },
        { numero: 517372421, endoso: 0 }
    ];

    for (const poliza of polizas) {

        try {
            const resultado =
                await service.obtenerPeriodicidadFacturacion(
                    poliza.numero,
                    poliza.endoso
                );

            console.log({
                poliza: poliza.numero,
                periodicidad: resultado
            });

        } catch (error) {
            console.error(
                `Error analizando póliza ${poliza.numero}:`,
                error
            );
        }
    }
}

main().catch(console.error);