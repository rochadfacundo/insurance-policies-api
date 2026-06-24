import { RusCarteraService } from "./rus/services/rusCarteraService";
import { guardarJson } from "./utils/jsonUtils";

async function main() {

    try {

        const PRODUCTOR = 4666;

        const POLIZA = 13487156;

        const carteraService = new RusCarteraService();

        const cartera = await carteraService.obtenerUltimoAnio(PRODUCTOR);

        const movimientos = cartera.getPropuestas().filter(p => p.numeroPoliza === POLIZA);

        console.log("");
        console.log("================================");
        console.log(`POLIZA ${POLIZA}`);
        console.log("================================");

        console.log(`Movimientos encontrados: ${movimientos.length}`);

        movimientos.sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision));

        for (const mov of movimientos) {

            console.log("");

            console.log("--------------------------------");

            console.log(`Fecha: ${mov.fechaEmision}`);

            console.log(`Propuesta: ${mov.propuesta}`);

            console.log(`Renovación: ${mov.renovacion}`);

            console.log(`Endoso: ${mov.endoso}`);

            console.log(`Premio: ${mov.premio}`);

            console.log(`Estado: ${mov.estadoPoliza}`);

            console.log(`Vigencia: ${mov.vigenciaEstado}`);

            console.log(`Flota: ${mov.esFlota}`);
        }

        guardarJson(movimientos,`rus-poliza-${POLIZA}.json`);

    } catch (error) {

        console.error(error);
    }
}

main();