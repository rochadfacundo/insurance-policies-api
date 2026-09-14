import { RenovacionesService } from "../src/services/renovacionesService";

async function main(): Promise<void> {

    const renovacionesService =
        new RenovacionesService();


    // Simulamos ejecución del 20/09/2026
    const fechaPrueba =
        new Date(2026, 9, 20);


    console.log(
        `Buscando renovaciones del mes siguiente a ` +
        `${fechaPrueba.toLocaleDateString("es-AR")}`
    );


    const grupos =
        await renovacionesService
            .obtenerRenovacionesPorEjecutiva(
                fechaPrueba
            );


    console.log(
        `Ejecutivas con renovaciones: ${grupos.length}`
    );


    for (const grupo of grupos) {

        console.log("\n===================================");

        console.log(
            `Ejecutiva: ` +
            `${grupo.ejecutiva.nombre} ` +
            `${grupo.ejecutiva.apellido}`
        );

        console.log(
            `Email: ${grupo.ejecutiva.email}`
        );

        console.log(
            `Cantidad de pólizas: ${grupo.polizas.length}`
        );

        console.log("===================================");


        for (const poliza of grupo.polizas) {

            console.log({
                compania:
                    poliza.compania,

                productor:
                    poliza.productor,

                poliza:
                    poliza.detallePoliza.numeroPoliza,

                asegurado:
                    poliza.cliente?.nombre,

                vencimiento:
                    poliza.vigencia?.hasta instanceof Date
                        ? poliza.vigencia.hasta
                            .toLocaleDateString("es-AR")
                        : poliza.vigencia?.hasta
            });
        }
    }
}


main()
    .then(() => {

        console.log(
            "\nProceso finalizado."
        );

        process.exit(0);
    })
    .catch(error => {

        console.error(
            "Error procesando renovaciones:",
            error
        );

        process.exit(1);
    });