import dotenv from "dotenv";
import path from "path";
import { MercantilCarteraService } from "../src/companias/mercantil/services/mercantilCarteraService";

dotenv.config({
    path: path.resolve(__dirname, "../.env.scripts.backup")
});
console.log("MA_BASE_URL configurada:", Boolean(process.env.MA_BASE_URL));
console.log("MA_SUBSCRIPTION_KEY configurada:", Boolean(process.env.MA_SUBSCRIPTION_KEY));
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

const POLIZAS = [
    516739464,
    516889532,
    516863085,
    516890062,
    517370668,
    516950802,
    516556190,
    517157666,
    517372421,
    516735589,
    516800324,
    517188303,
    516810315,
    516817869,
    171969982,
    517176710,
    517261449,
    517356083,
    191197309
];
async function main(): Promise<void> {

    const { MercantilCarteraService } = await import(
        "../src/companias/mercantil/services/mercantilCarteraService"
    );

    const service = new MercantilCarteraService();

    console.log("\n========================================");
    console.log("AUDITORÍA FACTURACIÓN MERCANTIL");
    console.log("========================================");

    const resultados = [];

    for (const numeroPoliza of POLIZAS) {

        console.log(`\nConsultando póliza ${numeroPoliza}...`);

        const movimientos = [];

        // Límite preventivo de endosos a consultar.
        const MAX_ENDOSOS = 30;

        for (let endoso = 0; endoso <= MAX_ENDOSOS; endoso++) {

            try {

                const detalle = await service.obtenerDetallePoliza(
                    numeroPoliza,
                    endoso
                );

                const modelo = detalle.getModel();

                movimientos.push({
                    endoso: detalle.getEndoso(),
                    tipo: detalle.getTipo(),
                    desde: modelo.desde,
                    hasta: modelo.hasta
                });

            } catch (error) {

                // Detenemos al encontrar un endoso no disponible.
                break;
            }
        }

        const facturaciones = movimientos.filter(
            movimiento =>
                movimiento.tipo?.trim().toUpperCase() === "FACTURACION"
        );

        const ultimoMovimiento = movimientos[movimientos.length - 1];

        if (ultimoMovimiento) {

            const periodicidadAutomatica =
                await service.obtenerPeriodicidadFacturacion(
                    numeroPoliza,
                    ultimoMovimiento.endoso
                );

                const analisis = await service.analizarFacturacion(
                    numeroPoliza,
                    ultimoMovimiento.endoso
                );
                
                const coinciden =
                    analisis.periodicidadFacturacion === periodicidadAutomatica;
                
                console.log("COMPARACIÓN:", {
                    poliza: numeroPoliza,
                    detectorAnterior: periodicidadAutomatica,
                    detectorUnificado: analisis.periodicidadFacturacion,
                    coinciden,
                    tipoDetalleEconomico: analisis.detalleFacturacion.getTipo(),
                    endosoDetalleEconomico: analisis.detalleFacturacion.getEndoso()
                });

            console.log("DETECTOR AUTOMÁTICO:", {
                poliza: numeroPoliza,
                endosoActualConsultado: ultimoMovimiento.endoso,
                periodicidad: periodicidadAutomatica
            });

        }

        const referencia =
            facturaciones.length > 0
                ? facturaciones[facturaciones.length - 1]
                : movimientos[0];

        let meses: number | null = null;

        if (referencia) {

            const desde = new Date(referencia.desde);
            const hasta = new Date(referencia.hasta);

            if (
                !Number.isNaN(desde.getTime()) &&
                !Number.isNaN(hasta.getTime()) &&
                hasta > desde
            ) {

                meses =
                    (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 +
                    (hasta.getUTCMonth() - desde.getUTCMonth());
            }
        }

        const resultado = {

            poliza: numeroPoliza,

            endososConsultados: movimientos.length,

            facturaciones: facturaciones.length,

            ultimoTipo: referencia?.tipo ?? "SIN DATOS",

            desde: referencia?.desde ?? "-",

            hasta: referencia?.hasta ?? "-",

            meses,

            posibleMensual: meses === 1
        };

        resultados.push(resultado);

        console.table(movimientos);
    }

    console.log("\n========================================");
    console.log("RESUMEN GENERAL");
    console.log("========================================");

    console.table(resultados);

    console.log("\nPosibles pólizas mensuales:");

    console.table(
        resultados.filter(resultado => resultado.posibleMensual)
    );

    console.log("\nAuditoría finalizada.");
    console.log("No se realizaron escrituras en Firestore.");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });