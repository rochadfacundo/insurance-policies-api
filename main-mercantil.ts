import { MercantilCarteraService }
from "./mercantil/services/mercantilCarteraService";

import { obtenerDetallePoliza }
from "./mercantil/services/mercantilDetallePolizaService";

async function main() {

    try {

        const PRODUCTOR = 97715;

        const carteraService =
            new MercantilCarteraService();

        const manager =
            await carteraService
                .obtenerCarteraCompleta(
                    PRODUCTOR
                );

        const poliza =
            manager.getPolizas()[0];

        console.log(
            "POLIZA SELECCIONADA:"
        );

        console.log(poliza);

        if(poliza === undefined) {

            throw new Error("No se encontraron pólizas para el productor especificado.");
        }

        const detalle = await obtenerDetallePoliza(poliza.poliza,poliza.endoso);    

        console.log(
            JSON.stringify(
                detalle,
                null,
                2
            )
        );

    } catch (error: any) {

        console.error(
            error?.response?.status
        );

        console.error(
            error?.response?.data
        );
    }
}

main();