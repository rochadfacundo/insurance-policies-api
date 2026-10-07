/* eslint-disable max-len */

import * as dotenv from "dotenv";
import * as path from "path";

import { FedPatAuthService }
    from "../src/companias/fed-pat/services/fedPatAuthService";

import { FedPatCertificadosService }
    from "../src/companias/fed-pat/services/fedPatCertificadosService";

import { FedPatCertificadosEndososService }
    from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";

import {
    FedPatFeedDiario,
    FedPatPolizaStateService
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import { FedPatPolizaState }
    from "../src/companias/fed-pat/models/fedPatPolizaState";

import { FedPatCertificadoEndoso }
    from "../src/companias/fed-pat/models/fedPatCertificadoEndoso";

import { DateUtils }
    from "../src/utils/dateUtils";


/**
 * Carga las variables de entorno utilizadas por los servicios
 * de Federación Patronal.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Clasificación exclusivamente diagnóstica.
 *
 * No representa todavía un estado de negocio que deba
 * persistirse en Firestore.
 */
enum ClasificacionT2 {
    RENOVADA = "RENOVADA",
    VIGENTE_SIN_RENOVACION = "VIGENTE_SIN_RENOVACION",
    VENCIDA_SIN_RENOVACION = "VENCIDA_SIN_RENOVACION"
}


/**
 * Obtiene el certificado principal de una póliza.
 *
 * El certificado 0 se utiliza actualmente como cabecera
 * contractual dentro de la integración.
 */
function obtenerCertificadoPrincipal(
    estado: FedPatPolizaState
) {

    return (
        estado.certificados.find(
            certificado =>
                certificado.certificado === 0
        ) ?? null
    );
}


/**
 * Obtiene los endosos correspondientes al certificado principal
 * ordenados por número de endoso.
 */
function obtenerEndososPrincipales(
    estado: FedPatPolizaState
): FedPatCertificadoEndoso[] {

    return estado.endosos
        .filter(
            endoso =>
                endoso.certificado === 0
        )
        .sort(
            (a, b) =>
                a.endoso - b.endoso
        );
}


/**
 * Obtiene el último movimiento de un tipo determinado.
 *
 * Se utiliza únicamente para resumir la historia de movimientos
 * E, R y F del certificado principal.
 */
function obtenerUltimoMovimiento(
    estado: FedPatPolizaState,
    tipoBuscado: string
): FedPatCertificadoEndoso | null {

    const tipoNormalizado =
        tipoBuscado
            .trim()
            .toUpperCase();

    const movimientos =
        obtenerEndososPrincipales(
            estado
        )
            .filter(
                endoso =>
                    endoso.tipo_endoso
                        ?.trim()
                        .toUpperCase() ===
                    tipoNormalizado
            );

    return (
        movimientos.at(-1) ??
        null
    );
}


/**
 * Convierte YYYY-MM-DD a un timestamp de calendario.
 *
 * Se fija la hora en UTC para evitar que cambios de zona horaria
 * alteren el cálculo diagnóstico de días.
 */
function obtenerTimestampUTC(
    fecha: string
): number | null {

    const partes =
        fecha.split("-");

    const anio =
        Number(
            partes.at(0)
        );

    const mes =
        Number(
            partes.at(1)
        );

    const dia =
        Number(
            partes.at(2)
        );

    if (
        !Number.isInteger(anio) ||
        !Number.isInteger(mes) ||
        !Number.isInteger(dia)
    ) {
        return null;
    }

    return Date.UTC(
        anio,
        mes - 1,
        dia
    );
}


/**
 * Convierte una fecha DD/MM/YYYY a YYYY-MM-DD.
 */
function convertirFechaConsultaAISO(
    fecha: string
): string | null {

    const partes =
        fecha.split("/");

    const dia =
        partes.at(0) ?? null;

    const mes =
        partes.at(1) ?? null;

    const anio =
        partes.at(2) ?? null;

    if (
        dia === null ||
        mes === null ||
        anio === null
    ) {
        return null;
    }

    return `${anio}-${mes}-${dia}`;
}


/**
 * Calcula:
 *
 * fechaObjetivo - fechaReferencia
 *
 * Positivo:
 * todavía faltan días para la fecha objetivo.
 *
 * Cero:
 * ambas fechas coinciden.
 *
 * Negativo:
 * la fecha objetivo ya ocurrió.
 */
function calcularDiasHasta(
    fechaReferencia: string,
    fechaObjetivo: string
): number | null {

    const referencia =
        obtenerTimestampUTC(
            fechaReferencia
        );

    const objetivo =
        obtenerTimestampUTC(
            fechaObjetivo
        );

    if (
        referencia === null ||
        objetivo === null
    ) {
        return null;
    }

    const MILISEGUNDOS_DIA =
        1000 * 60 * 60 * 24;

    return Math.round(
        (objetivo - referencia) /
        MILISEGUNDOS_DIA
    );
}


/**
 * Imprime un movimiento resumido.
 *
 * Se conservan solamente los campos necesarios para estudiar
 * vigencia, emisión y motivo del movimiento.
 */
function mostrarMovimiento(
    nombre: string,
    movimiento: FedPatCertificadoEndoso | null
): void {

    console.log("");
    console.log(nombre);

    if (movimiento === null) {

        console.log(
            "No encontrado."
        );

        return;
    }

    console.log({
        endoso:
            movimiento.endoso,

        tipo:
            movimiento.tipo_endoso,

        codigoMotivo:
            movimiento.codigo_motivo_endoso,

        fechaEmision:
            movimiento.fecha_emision,

        vigenciaDesde:
            movimiento.vigencia_desde,

        vigenciaHasta:
            movimiento.vigencia_hasta,

        prima:
            movimiento.prima
    });
}


/**
 * Reconstruye la cartera y clasifica todas las pólizas T/2
 * encontradas en el período.
 *
 * El objetivo es entender qué ocurre con aquellas pólizas que
 * todavía no presentan una relación de renovación mediante
 * renueva_a.
 *
 * No utiliza mapper, RiskEngine, repositorios ni Firestore.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();

    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO GENERAL PÓLIZAS T/2"
    );

    console.log(
        "=================================================="
    );


    const authService =
        new FedPatAuthService();

    const certificadosService =
        new FedPatCertificadosService(
            authService
        );

    const endososService =
        new FedPatCertificadosEndososService(
            authService
        );

    const stateService =
        new FedPatPolizaStateService();


    /**
     * Se utiliza ayer como límite superior porque los endpoints
     * operacionales de Federación trabajan con feeds diarios
     * cerrados.
     */
    const fechaHasta =
        DateUtils.restarDiasDDMMYYYY(
            DateUtils.formatearFechaDDMMYYYY(
                new Date()
            ),
            1
        );

    const fechaDesde =
        DateUtils.restarDiasDDMMYYYY(
            fechaHasta,
            365
        );

    const fechas =
        DateUtils.generarFechas(
            fechaDesde,
            fechaHasta
        );

    const fechaReferencia =
        convertirFechaConsultaAISO(
            fechaHasta
        );

    if (fechaReferencia === null) {

        throw new Error(
            `No se pudo convertir fechaHasta: ${fechaHasta}`
        );
    }


    console.log(
        `Desde: ${fechaDesde}`
    );

    console.log(
        `Hasta: ${fechaHasta}`
    );

    console.log(
        `Días: ${fechas.length}`
    );

    console.log("");


    const estados =
        new Map<string, FedPatPolizaState>();


    /**
     * Reconstruimos toda la cartera porque la relación de
     * renovación se encuentra en la póliza nueva mediante
     * el campo renueva_a.
     */
    for (
        let indice = 0;
        indice < fechas.length;
        indice++
    ) {

        const fecha =
            fechas.at(indice) ?? null;

        if (fecha === null) {
            continue;
        }


        const [
            certificados,
            endosos
        ] = await Promise.all([

            certificadosService
                .obtenerCertificados(
                    fecha
                ),

            endososService
                .obtenerEndosos(
                    fecha
                )
        ]);


        const feed: FedPatFeedDiario = {
            fecha,
            certificados,
            endosos,
            sumas: [],
            productosDatos: [],
            riesgosCubiertos: [],
            componentes: []
        };


        stateService.acumularFeed(
            estados,
            feed
        );


        if (
            (indice + 1) % 30 === 0 ||
            indice === fechas.length - 1
        ) {

            console.log(
                `Procesadas ` +
                `${indice + 1}/${fechas.length} fechas`
            );
        }
    }


    console.log("");
    console.log(
        `Estados reconstruidos: ${estados.size}`
    );


    /**
     * Índice:
     *
     * numero de póliza anterior -> póliza renovadora.
     *
     * La evidencia histórica observada indica que renueva_a
     * se encuentra en la póliza nueva y referencia a la anterior.
     *
     * Se mantiene una lista porque no queremos asumir todavía
     * que la relación sea estrictamente uno a uno.
     */
    const renovaciones =
        new Map<number, FedPatPolizaState[]>();


    for (const estado of estados.values()) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );

        if (
            certificado === null ||
            certificado.renueva_a === null
        ) {
            continue;
        }


        const existentes =
            renovaciones.get(
                certificado.renueva_a
            ) ?? [];


        existentes.push(
            estado
        );


        renovaciones.set(
            certificado.renueva_a,
            existentes
        );
    }


    let totalT2 = 0;

    let renovadas = 0;

    let vigentesSinRenovacion = 0;

    let vencidasSinRenovacion = 0;


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "DETALLE T/2"
    );

    console.log(
        "=================================================="
    );


    for (const estado of estados.values()) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );


        if (certificado === null) {
            continue;
        }


        /**
         * T = COLECT.FLOTA CON REFAC.
         *
         * El catálogo oficial confirmó esta descripción.
         * En este diagnóstico nos interesan únicamente las
         * pólizas configuradas con dos períodos.
         */
        if (
            certificado.tipo_facturacion !== "T" ||
            certificado.cant_facturacion !== 2
        ) {
            continue;
        }


        totalT2++;


        const polizasRenovadoras =
            renovaciones.get(
                certificado.numero_poliza
            ) ?? [];


        const diasHastaVencimiento =
            calcularDiasHasta(
                fechaReferencia,
                certificado.vigencia_hasta
            );


        let clasificacion:
            ClasificacionT2;


        if (polizasRenovadoras.length > 0) {

            clasificacion =
                ClasificacionT2.RENOVADA;

            renovadas++;

        } else if (
            diasHastaVencimiento !== null &&
            diasHastaVencimiento >= 0
        ) {

            clasificacion =
                ClasificacionT2
                    .VIGENTE_SIN_RENOVACION;

            vigentesSinRenovacion++;

        } else {

            clasificacion =
                ClasificacionT2
                    .VENCIDA_SIN_RENOVACION;

            vencidasSinRenovacion++;
        }


        const ultimoE =
            obtenerUltimoMovimiento(
                estado,
                "E"
            );

        const ultimoR =
            obtenerUltimoMovimiento(
                estado,
                "R"
            );

        const ultimoF =
            obtenerUltimoMovimiento(
                estado,
                "F"
            );


        console.log("");
        console.log(
            "##################################################"
        );

        console.log(
            `PÓLIZA ${certificado.numero_poliza}`
        );

        console.log(
            "##################################################"
        );


        console.log({
            clasificacion,

            ramo:
                certificado.codigo_ramo,

            numeroPoliza:
                certificado.numero_poliza,

            estadoCertificado:
                certificado.estado_certificado,

            tipoFacturacion:
                certificado.tipo_facturacion,

            cantidadFacturacion:
                certificado.cant_facturacion,

            vigenciaDesde:
                certificado.vigencia_desde,

            vigenciaHasta:
                certificado.vigencia_hasta,

            diasHastaVencimiento,

            renovadaPor:
                certificado.renovada_por,

            renuevaA:
                certificado.renueva_a,

            cantidadPolizasRenovadoras:
                polizasRenovadoras.length
        });


        mostrarMovimiento(
            "ÚLTIMO E",
            ultimoE
        );

        mostrarMovimiento(
            "ÚLTIMO R",
            ultimoR
        );

        mostrarMovimiento(
            "ÚLTIMO F",
            ultimoF
        );


        /**
         * Si existe una renovación conocida mostramos también
         * los datos contractuales de la nueva póliza.
         */
        if (polizasRenovadoras.length > 0) {

            console.log("");
            console.log(
                "PÓLIZA/S RENOVADORA/S"
            );


            for (
                const estadoRenovador
                of polizasRenovadoras
            ) {

                const renovadora =
                    obtenerCertificadoPrincipal(
                        estadoRenovador
                    );

                if (renovadora === null) {
                    continue;
                }


                const movimientoInicial =
                    obtenerUltimoMovimiento(
                        estadoRenovador,
                        "R"
                    ) ??
                    obtenerUltimoMovimiento(
                        estadoRenovador,
                        "E"
                    );


                console.log({
                    numeroPoliza:
                        renovadora.numero_poliza,

                    estadoCertificado:
                        renovadora.estado_certificado,

                    vigenciaDesde:
                        renovadora.vigencia_desde,

                    vigenciaHasta:
                        renovadora.vigencia_hasta,

                    renuevaA:
                        renovadora.renueva_a,

                    fechaEmision:
                        movimientoInicial
                            ?.fecha_emision ??
                        null
                });
            }
        }
    }


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "RESUMEN T/2"
    );

    console.log(
        "=================================================="
    );


    console.log({
        fechaReferencia,

        estadosReconstruidos:
            estados.size,

        totalT2,

        renovadas,

        vigentesSinRenovacion,

        vencidasSinRenovacion,

        duracion:
            DateUtils.formatearDuracion(
                Date.now() - inicio
            )
    });


    console.log(
        "=================================================="
    );

    console.log(
        "FIN DEL TEST"
    );

    console.log(
        "=================================================="
    );
}


main()
    .catch(
        (error: unknown) => {

            console.error(
                "Error ejecutando diagnóstico general T/2:",
                error
            );

            process.exit(1);
        }
    );