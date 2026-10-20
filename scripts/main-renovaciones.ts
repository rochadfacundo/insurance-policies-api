import dotenv from "dotenv";

import {
    RenovacionesService
} from "../src/services/renovacionesService";

import {
    ExcelRenovacionesService
} from "../src/services/excelRenovacionesService";

import {
    EmailService
} from "../src/services/emailService";

import {
    RenovacionesEjecutiva
} from "../src/models/renovacionesEjecutiva";

import {
    Poliza
} from "../src/models/poliza";
import { DateUtils } from "../src/utils/dateUtils";


dotenv.config({
    path: "../.env"
});


/*
 * ============================================================
 * FECHA DE REFERENCIA
 * ============================================================
 *
 * Utilizamos la fecha actual del sistema.
 *
 * RenovacionesService buscará las pólizas cuyo vencimiento
 * corresponda al mes calendario siguiente.
 *
 * Ejemplos:
 * 20/10/2026 → vencimientos de noviembre de 2026.
 * 20/11/2026 → vencimientos de diciembre de 2026.
 * 20/12/2026 → vencimientos de enero de 2027.
 */

//const FECHA_REFERENCIA = new Date();
const FECHA_REFERENCIA = new Date(2026, 9, 20);

/*
 * IMPORTANTE:
 *
 * Durante esta prueba TODOS los correos se envían a Mica.
 *
 * No se utiliza todavía el email real de cada ejecutiva.
 */
const EMAIL_PRUEBA =
        //"mrocha@tecnicayseguros.com.ar";
        "locotoranzo@gmail.com";

/*
 * true:
 * todos los correos se envían a EMAIL_PRUEBA.
 *
 * false:
 * cada correo se envía al email real de la ejecutiva.
 */
const MODO_PRUEBA = false;


/*
 * Control adicional de seguridad.
 *
 * true  -> envía los correos.
 * false -> solamente muestra el preview.
 *
 * Cuando quieras realizar la prueba real con Mica,
 * dejarlo en true.
 */
const ENVIAR_EMAIL = false;


/*
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

/**

 * Formatea una fecha utilizando UTC.
 *
 * Mantiene el mismo criterio que Angular,
 * evitando diferencias por zona horaria.
 *
 * @param fecha Fecha que se desea formatear.
 * @returns Fecha en formato DD/MM/YYYY.
 */
function formatearFecha(fecha: Date): string {

    return fecha.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC"
    });
}


/**
 * Obtiene la fecha de vencimiento de una póliza.
 *
 * Contemplamos tanto Date como Timestamp
 * proveniente de Firestore.
 */
function obtenerFechaVencimiento(poliza: Poliza): Date | null {

    const hasta =
        poliza.vigencia?.hasta;


    if (!hasta) {
        return null;
    }


    if (hasta instanceof Date) {
        return hasta;
    }


    if (
        typeof hasta === "object" &&
        "toDate" in hasta &&
        typeof (hasta as any).toDate === "function"
    ) {

        return (hasta as any).toDate();
    }


    return null;
}



/**
 * Ordena las pólizas por su fecha de próxima gestión.
 *
 * Utiliza la misma lógica que RenovacionesService:
 * - Mercantil y RUS: fin del período de facturación.
 * - Federación Patronal: fechaProximaGestion.
 *
 * Las pólizas con gestión más próxima aparecen primero.
 *
 * @param polizas Pólizas que se desean ordenar.
 * @param renovacionesService Servicio que resuelve la fecha de gestión.
 * @returns Nuevo arreglo de pólizas ordenadas.
 */
function ordenarPorProximaGestion(
    polizas: Poliza[],
    renovacionesService: RenovacionesService
): Poliza[] {

    return [...polizas].sort((a, b) => {

        const fechaA = renovacionesService.obtenerFechaProximaGestion(a);
        const fechaB = renovacionesService.obtenerFechaProximaGestion(b);

        if (!fechaA && !fechaB) return 0;
        if (!fechaA) return 1;
        if (!fechaB) return -1;

        return fechaA.getTime() - fechaB.getTime();
    });
}



/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("PRUEBA ENVÍO RENOVACIONES NOVIEMBRE 2026");
    console.log("Fecha simulada:     20/10/2026");
    console.log("Período:            01/11/2026 - 30/11/2026");
    console.log("==================================================");
    //console.log(`Email de prueba:    ${EMAIL_PRUEBA}`);

    console.log(
        `Modo:               ${
            ENVIAR_EMAIL
                ? "ENVÍO ACTIVADO"
                : "PREVIEW - NO ENVÍA"
        }`
    );

    console.log("");


    /*
     * ========================================================
     * SERVICIOS
     * ========================================================
     */

    const renovacionesService = new RenovacionesService();

    const excelRenovacionesService = new ExcelRenovacionesService();

    const emailService = new EmailService();


    /*
     * ========================================================
     * OBTENEMOS LAS RENOVACIONES
     * ========================================================
     *
     * Utilizamos exactamente la misma lógica que después
     * utilizará el proceso automático del día 20.
     */

    const renovaciones: RenovacionesEjecutiva[] = await renovacionesService.obtenerRenovacionesPorEjecutiva(FECHA_REFERENCIA);

    /*
    * Proximo mes a renovar
    */
    const mesRenovacion = DateUtils.obtenerMesRenovacion(FECHA_REFERENCIA);

    /*
     * Ordenamos las ejecutivas alfabéticamente.
     */
    renovaciones.sort(
        (a, b) => {

            const nombreA =`${a.ejecutiva.nombre} ${a.ejecutiva.apellido}`;
            const nombreB =`${b.ejecutiva.nombre} ${b.ejecutiva.apellido}`;

            return nombreA.localeCompare(nombreB);
        }
    );


    /*
     * ========================================================
     * VALIDACIÓN
     * ========================================================
     */

    if (renovaciones.length === 0) {

        console.log(`⚠ No se encontraron renovaciones para ${mesRenovacion}.`);

        return;
    }


    let totalPolizas = 0;


    /*
     * ========================================================
     * PREVIEW
     * ========================================================
     */

    console.log("");
    console.log("==================================================");
    console.log("PREVIEW DE CORREOS");
    console.log("==================================================");


    for (const grupo of renovaciones) {

        const polizas = ordenarPorProximaGestion(grupo.polizas,renovacionesService);


        totalPolizas += polizas.length;


        const destinatario = MODO_PRUEBA
            ? EMAIL_PRUEBA
            : grupo.ejecutiva.email;

        console.log(`EJECUTIVA:       ${grupo.ejecutiva.nombre} ${grupo.ejecutiva.apellido}`);
        console.log(`DESTINATARIO:    ${destinatario}`);
        console.log(`PÓLIZAS:         ${polizas.length}`);


        for (const poliza of polizas) {

            const fechaGestion = renovacionesService.obtenerFechaProximaGestion(poliza);


            console.log("");

            console.log(`Productor:   ${poliza.productor.nombre}`);
            console.log(`Código PAS:  ${poliza.productor.codigo}`);
            console.log(`Compañía:    ${poliza.compania}`);
            console.log(`N° Póliza:   ${poliza.detallePoliza.numeroPoliza}`);
            console.log(`Asegurado:   ${poliza.cliente.nombre}`);
            console.log(`Próxima gestión: ${  fechaGestion
                    ? formatearFecha(fechaGestion)
                    : "SIN FECHA" }`);

            console.log("--------------------------------------------------");
        }
    }


    /*
     * ========================================================
     * RESUMEN ANTES DE ENVIAR
     * ========================================================
     */

    console.log("");
    console.log("");
    console.log("==================================================");
    console.log("RESUMEN");
    console.log("==================================================");

    console.log(`Correos a generar: ${renovaciones.length}`);
    console.log(`Total pólizas:     ${totalPolizas}`);
    console.log(`Modo destinatarios: ${
            MODO_PRUEBA
                ? `PRUEBA → ${EMAIL_PRUEBA}`
                : "REALES" }`);


    /*
     * ========================================================
     * MODO PREVIEW
     * ========================================================
     */

    if (!ENVIAR_EMAIL) {

        console.log("");
        console.log("⚠ ENVIAR_EMAIL = false");
        console.log("No se envió ningún correo.");

        return;
    }


    /*
     * ========================================================
     * ENVÍO DE CORREOS
     * ========================================================
     *
     * Generamos UN correo por ejecutiva.
     *
     * IMPORTANTE:
     * el destinatario se fuerza a EMAIL_PRUEBA.
     *
     * De esta manera podemos probar todo el proceso
     * sin enviar nada a las ejecutivas reales.
     */

    console.log("");
    console.log("");
    console.log("==================================================");
    console.log(MODO_PRUEBA ? "ENVIANDO CORREOS DE PRUEBA" : "ENVIANDO CORREOS");
    console.log("==================================================");


    let correosEnviados = 0;


    for (const grupo of renovaciones) {

        /*
         * Ordenamos también las pólizas del Excel.
         */
        const polizas = ordenarPorProximaGestion(grupo.polizas, renovacionesService);


        const nombreEjecutiva = `${grupo.ejecutiva.nombre}`;

        const destinatario = MODO_PRUEBA
        ? EMAIL_PRUEBA
        : grupo.ejecutiva.email;


        console.log("");
        console.log(`Preparando correo correspondiente a ${nombreEjecutiva}...`);


        /*
         * Generamos el Excel en memoria.
         */
        const excel = await excelRenovacionesService.generarExcel(polizas);


        /*
         * Nombre del archivo.
         *
         * Incluimos el ID de la ejecutiva para que
         * Mica pueda diferenciar fácilmente cada Excel.
         */
        const mesArchivo = mesRenovacion.toLowerCase().replace(/\s+/g, "-");

        const nombreArchivo =`renovaciones-${mesArchivo}-${grupo.ejecutiva.id}.xlsx`;


        console.log(`Excel generado: ${nombreArchivo}`);


        /*
         * Enviamos el correo.
         *
         * ATENCIÓN:
         * destinatario NO es grupo.ejecutiva.email.
         *
         * Durante esta prueba todos van a Mica.
         */
        await emailService.enviar({
            destinatario,
            /*
             * Dejamos el nombre de la ejecutiva original.
             *
             * Así Mica puede ver cómo sería el correo
             * correspondiente a esa ejecutiva.
             */
            nombreDestinatario: nombreEjecutiva,
            mesRenovacion: mesRenovacion,
            cantidadPolizas: polizas.length,
            mensaje:``,
            adjunto: {
                nombreArchivo,
                contenido: excel
            }
        });


        correosEnviados++;


        console.log(`✓ Correo de ${nombreEjecutiva} enviado a ${destinatario}`);
    }


    /*
     * ========================================================
     * RESULTADO FINAL
     * ========================================================
     */

    console.log("");
    console.log("");
    console.log("==================================================");
    console.log(MODO_PRUEBA ? "PRUEBA FINALIZADA"  : "ENVÍO FINALIZADO");
    console.log("==================================================");

    console.log(`Correos enviados: ${correosEnviados}`);

    console.log(`Total pólizas:    ${totalPolizas}`);
 
    console.log(`Modo:             ${
            MODO_PRUEBA
                ? `PRUEBA → ${EMAIL_PRUEBA}`
                : "DESTINATARIOS REALES"
        }`
    );

    console.log("==================================================");
}


/*
 * ============================================================
 * EJECUCIÓN
 * ============================================================
 */

main()
    .then(() => {

        console.log("");
        console.log("Proceso finalizado correctamente.");

        process.exit(0);
    })
    .catch(error => {

        console.error("");
        console.error("❌ Error ejecutando prueba de renovaciones:");

        console.error(error);

        process.exit(1);
    });