import {obtenerProductoresRUSConMatricula} from "../src/companias/rus/productoresRUS";

import {RusStatsCarteraService} from "../src/companias/rus/services/rusStatsCarteraService";

import {FirestoreStatsCarteraRepository} from "../src/repositories/firestoreStatsCarteraRepository";


function formatearFecha(fecha: Date): string {

    return fecha
        .toISOString()
        .slice(0, 10);
}


async function main(): Promise<void> {

    const productores = obtenerProductoresRUSConMatricula();

    if (productores.length === 0) {
        throw new Error("No se encontraron productores RUS activos.");
    }

    const statsService = new RusStatsCarteraService();

    const statsRepository = new FirestoreStatsCarteraRepository();


    /*
     * Cartera anual móvil.
     */
    const hasta = new Date();

    const desde = new Date(hasta);

    desde.setFullYear(desde.getFullYear() - 1);

    const fechaDesde = formatearFecha(desde);

    const fechaHasta = formatearFecha(hasta);


    console.log("");
    console.log(
        "=================================================="
    );
    console.log(
        "ESTADÍSTICAS CARTERA RUS"
    );
    console.log(
        "=================================================="
    );

    console.log({
        productoresTotales: productores.length,
        fechaDesde,
        fechaHasta
    });


    for (const [index, productor] of productores.entries()) {

        console.log("");
        console.log("--------------------------------------------------");

        console.log(`[${index + 1}/${productores.length}] ` +`${productor.codigo} - ${productor.nombre}`);

        console.log("--------------------------------------------------");


        try {

            const estadistica =
                await statsService.obtener(productor,fechaDesde,fechaHasta);


            await statsRepository.guardar(estadistica);


            console.log({
                matricula:
                    estadistica.matricula,

                cantidadPolizas:
                    estadistica.cantidadPolizas,

                grupoCartera:
                    estadistica.grupoCartera ?? null
            });


        } catch (error) {

            console.error(
                `Error procesando productor ${productor.codigo}:`,
                error
            );
        }
    }


    console.log("");
    console.log("==================================================");
    console.log("PROCESO RUS FINALIZADO");
    console.log("==================================================");
}


main()
    .then(() => {

        console.log("");
        console.log("Proceso finalizado.");

    })
    .catch(
        (error: unknown) => {

        console.error("");
        console.error( "Error generando estadísticas RUS.");
        console.error(error);

        process.exitCode = 1;
    });