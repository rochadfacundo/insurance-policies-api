import dotenv from "dotenv";

dotenv.config({
    path: "../.env"
});
console.log(
    "EMAIL_USER:",
    process.env.EMAIL_USER
);

console.log(
    "EMAIL_APP_PASSWORD cargada:",
    !!process.env.EMAIL_APP_PASSWORD
);

import { RenovacionesService } from "../src/services/renovacionesService";
import { EmailService } from "../src/services/emailService";
import { Poliza } from "../src/models/poliza";
import { ExcelRenovacionesService } from "../src/services/excelRenovacionesService";

async function main(): Promise<void> {

    const renovacionesService = new RenovacionesService();

    const emailService = new EmailService();

    // Simulamos que hoy es 20/10/2026.
    // Por lo tanto buscamos vencimientos de noviembre 2026.
    const fechaPrueba = new Date(2026, 9, 20);

    console.log(
        `Buscando renovaciones del mes siguiente a ` +
        `${fechaPrueba.toLocaleDateString("es-AR")}`
    );

    const excelRenovacionesService =  new ExcelRenovacionesService();
    
    const grupos = await renovacionesService.obtenerRenovacionesPorEjecutiva(fechaPrueba);


    console.log( `Ejecutivas con renovaciones: ${grupos.length}`);


    if (grupos.length === 0) {

        console.log(
            "No se encontraron renovaciones para enviar."
        );

        return;
    }


    const mesRenovacion = obtenerMesRenovacion(fechaPrueba);


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


        const mensaje = "Encontrarás adjunto el detalle de las pólizas próximas a vencer.";


        console.log("\nMensaje generado:\n");

        console.log(mensaje);


        console.log(
            `\nEnviando email a ` +
            `${grupo.ejecutiva.email}...`
        );

        const excelBuffer = await excelRenovacionesService.generarExcel(grupo.polizas);

        const nombreArchivo =`Renovaciones_${mesRenovacion.replace(" ", "_")}_` 
            + `${grupo.ejecutiva.nombre}_${grupo.ejecutiva.apellido}.xlsx`;

            await emailService.enviar({

                destinatario: grupo.ejecutiva.email,            
                nombreDestinatario: `${grupo.ejecutiva.nombre} ` +
                    `${grupo.ejecutiva.apellido}`,
                mesRenovacion,         
                cantidadPolizas: grupo.polizas.length,         
                mensaje,         
                adjunto: {
                            nombreArchivo: nombreArchivo,
                            contenido: excelBuffer
                         }
            });


        console.log(`Email enviado correctamente a ` + `${grupo.ejecutiva.email}`);
    }
}


/**
 * Obtiene el nombre del mes siguiente a la fecha indicada.
 *
 * Ejemplo:
 * 20/10/2026 -> Noviembre 2026
 */
function obtenerMesRenovacion(fechaReferencia: Date): string {

    const fechaMesSiguiente = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 1,1);

    const mes =fechaMesSiguiente.toLocaleDateString("es-AR",
            {
                month: "long",
                year: "numeric"
            }
        );


    return (mes.charAt(0).toUpperCase() + mes.slice(1));
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
            "\nError procesando renovaciones:",
            error
        );

        process.exit(1);
    });