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

import { guardarJson }
    from "../src/utils/jsonUtils";


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
 * Movimiento simplificado utilizado exclusivamente para diagnóstico.
 *
 * Se conserva suficiente información para reconstruir la secuencia
 * contractual del certificado principal sin depender nuevamente
 * de consultas a la API.
 */
interface MovimientoDiagnostico {
    endoso: number;
    tipo: string;
    codigoMotivo: number;
    fechaEmision: string;
    vigenciaDesde: string;
    vigenciaHasta: string;
    prima: number;
}


/**
 * Representa una póliza cuyo certificado principal se encuentra
 * en estado 11 pero para la cual no encontramos movimientos A
 * dentro de la ventana histórica consultada.
 *
 * Estos casos son importantes porque permiten comprobar si estado 11
 * puede utilizarse como criterio operativo independientemente del
 * historial parcial disponible.
 */
interface Estado11SinMovimientoA {
    ramo: number;
    numeroPoliza: number;

    estadoCertificado: number;
    fechaEstado: string;

    renovacionAutomatica: string;

    vigenciaDesde: string;
    vigenciaHasta: string;

    renuevaA: number | null;
    renovadaPor: number | null;

    cantidadMovimientos: number;

    primerMovimiento: MovimientoDiagnostico | null;
    ultimoMovimiento: MovimientoDiagnostico | null;

    movimientos: MovimientoDiagnostico[];
}


/**
 * Obtiene el certificado principal de una póliza.
 *
 * El certificado 0 funciona como cabecera contractual para
 * el análisis de estado, vigencia y renovación.
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
 * Normaliza el tipo de endoso recibido desde Federación Patronal.
 *
 * La normalización evita que espacios o diferencias de mayúsculas
 * afecten las comparaciones realizadas por el diagnóstico.
 */
function normalizarTipo(
    tipo: string | null | undefined
): string {

    return (
        tipo
            ?.trim()
            .toUpperCase() ??
        ""
    );
}


/**
 * Obtiene todos los movimientos del certificado principal ordenados
 * por número de endoso.
 *
 * No se utiliza el orden original del array porque no forma parte
 * del contrato de este diagnóstico.
 */
function obtenerMovimientosCertificadoPrincipal(
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
 * Determina si dentro del historial reconstruido existe al menos
 * un movimiento de tipo A para el certificado principal.
 */
function tieneMovimientoA(
    movimientos: FedPatCertificadoEndoso[]
): boolean {

    return movimientos.some(
        movimiento =>
            normalizarTipo(
                movimiento.tipo_endoso
            ) === "A"
    );
}


/**
 * Convierte un endoso al formato reducido utilizado en el JSON
 * diagnóstico.
 */
function mapearMovimiento(
    movimiento: FedPatCertificadoEndoso
): MovimientoDiagnostico {

    return {
        endoso:
            movimiento.endoso,

        tipo:
            normalizarTipo(
                movimiento.tipo_endoso
            ),

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
    };
}


/**
 * Diagnóstico final del estado 11.
 *
 * Reconstruye los últimos 366 días de certificados y endosos y
 * selecciona exclusivamente certificados principales que:
 *
 * 1. tengan estado_certificado = 11;
 * 2. no tengan ningún movimiento A dentro de la ventana reconstruida.
 *
 * El objetivo es estudiar las excepciones encontradas por test-fed12
 * antes de utilizar estado 11 como criterio de elegibilidad en producción.
 *
 * Este script no utiliza repositorios y no escribe en Firestore.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO ESTADO 11 SIN MOVIMIENTOS A"
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
     * Se conserva la misma ventana utilizada por test-fed10/11/12
     * para que los resultados sean directamente comparables.
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
     * Reconstruimos únicamente certificados y endosos.
     *
     * No son necesarios productos, sumas, riesgos ni componentes
     * para estudiar las excepciones del estado 11.
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


    const casos:
        Estado11SinMovimientoA[] = [];


    let totalEstado11 = 0;
    let estado11ConA = 0;


    for (const estado of estados.values()) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );

        if (certificado === null) {
            continue;
        }


        if (
            certificado.estado_certificado !== 11
        ) {
            continue;
        }


        totalEstado11++;


        const movimientos =
            obtenerMovimientosCertificadoPrincipal(
                estado
            );


        if (
            tieneMovimientoA(
                movimientos
            )
        ) {

            estado11ConA++;

            continue;
        }


        const movimientosMapeados =
            movimientos.map(
                mapearMovimiento
            );


        const primerMovimiento =
            movimientosMapeados.at(0) ??
            null;


        const ultimoMovimiento =
            movimientosMapeados.at(-1) ??
            null;


        casos.push({
            ramo:
                certificado.codigo_ramo,

            numeroPoliza:
                certificado.numero_poliza,

            estadoCertificado:
                certificado.estado_certificado,

            fechaEstado:
                certificado.fecha_estado,

            renovacionAutomatica:
                certificado.renovacion_aumatica,

            vigenciaDesde:
                certificado.vigencia_desde,

            vigenciaHasta:
                certificado.vigencia_hasta,

            renuevaA:
                certificado.renueva_a,

            renovadaPor:
                certificado.renovada_por,

            cantidadMovimientos:
                movimientosMapeados.length,

            primerMovimiento,

            ultimoMovimiento,

            movimientos:
                movimientosMapeados
        });
    }


    /**
     * Ordenamos por fecha_estado y luego por número de póliza.
     *
     * Las fechas ISO YYYY-MM-DD pueden compararse lexicográficamente
     * manteniendo el orden cronológico.
     */
    casos.sort(
        (a, b) => {

            const comparacionFecha =
                a.fechaEstado.localeCompare(
                    b.fechaEstado
                );

            if (comparacionFecha !== 0) {
                return comparacionFecha;
            }

            return (
                a.numeroPoliza -
                b.numeroPoliza
            );
        }
    );


    const rutaDetalle =
        path.resolve(
            process.cwd(),
            "fedpat-estado-11-sin-a.json"
        );


    guardarJson(
        casos,
        rutaDetalle
    );


    /**
     * Agrupamos las excepciones por último movimiento conocido.
     *
     * Esto permite detectar si las 63 pólizas se concentran en algún
     * tipo/motivo concreto aunque el movimiento A no esté disponible
     * dentro de la ventana histórica.
     */
    const distribucionUltimoMovimiento =
        new Map<
            string,
            {
                tipo: string;
                codigoMotivo: number | null;
                cantidad: number;
            }
        >();


    for (const caso of casos) {

        const tipo =
            caso.ultimoMovimiento?.tipo ??
            "SIN_MOVIMIENTO";

        const codigoMotivo =
            caso.ultimoMovimiento?.codigoMotivo ??
            null;


        const clave =
            `${tipo}|${codigoMotivo ?? "NULL"}`;


        const existente =
            distribucionUltimoMovimiento.get(
                clave
            );


        if (existente !== undefined) {

            existente.cantidad++;

            continue;
        }


        distribucionUltimoMovimiento.set(
            clave,
            {
                tipo,
                codigoMotivo,
                cantidad: 1
            }
        );
    }


    const distribucion =
        Array.from(
            distribucionUltimoMovimiento.values()
        )
            .sort(
                (a, b) =>
                    b.cantidad -
                    a.cantidad
            );


    /**
     * Analizamos también dónde cae fecha_estado respecto del inicio
     * de nuestra ventana histórica.
     *
     * Si fecha_estado es anterior a fechaDesde, es razonable considerar
     * que el movimiento que originó el estado 11 podría no estar incluido
     * en los 366 días reconstruidos.
     *
     * Esto sigue siendo una inferencia diagnóstica; no una regla de negocio.
     */
    const fechaDesdeIso =
        fechaDesde
            .split("/")
            .reverse()
            .join("-");


    const conFechaEstadoAnteriorVentana =
        casos.filter(
            caso =>
                caso.fechaEstado <
                fechaDesdeIso
        );


    const conFechaEstadoDentroVentana =
        casos.filter(
            caso =>
                caso.fechaEstado >=
                fechaDesdeIso
        );


    const sinMovimientos =
        casos.filter(
            caso =>
                caso.cantidadMovimientos === 0
        );


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "RESUMEN ESTADO 11"
    );

    console.log(
        "=================================================="
    );


    console.log({
        totalEstado11,

        estado11ConA,

        estado11SinA:
            casos.length,

        fechaDesdeHistorico:
            fechaDesdeIso,

        sinMovimientos:
            sinMovimientos.length,

        fechaEstadoAnteriorVentana:
            conFechaEstadoAnteriorVentana.length,

        fechaEstadoDentroVentana:
            conFechaEstadoDentroVentana.length
    });


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "ÚLTIMO MOVIMIENTO DE LOS CASOS SIN A"
    );

    console.log(
        "=================================================="
    );


    for (
        const item of
        distribucion.slice(0, 20)
    ) {

        console.log(item);
    }


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "CASOS CON FECHA_ESTADO DENTRO DE LA VENTANA"
    );

    console.log(
        "=================================================="
    );


    /**
     * Estos son los casos más interesantes.
     *
     * Si el cambio a estado 11 ocurrió dentro de nuestra ventana pero no
     * existe ningún movimiento A, habrá que investigar qué otro evento
     * puede producir ese estado.
     */
    for (
        const caso of
        conFechaEstadoDentroVentana.slice(0, 30)
    ) {

        console.log({
            ramo:
                caso.ramo,

            numeroPoliza:
                caso.numeroPoliza,

            fechaEstado:
                caso.fechaEstado,

            vigenciaDesde:
                caso.vigenciaDesde,

            vigenciaHasta:
                caso.vigenciaHasta,

            renovacionAutomatica:
                caso.renovacionAutomatica,

            cantidadMovimientos:
                caso.cantidadMovimientos,

            ultimoMovimiento:
                caso.ultimoMovimiento
        });
    }


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "RESUMEN FINAL"
    );

    console.log(
        "=================================================="
    );


    console.log({
        estadosReconstruidos:
            estados.size,

        totalEstado11,

        estado11ConA,

        estado11SinA:
            casos.length,

        archivoDetalle:
            rutaDetalle,

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
                "Error ejecutando diagnóstico de excepciones estado 11:",
                error
            );

            process.exit(1);
        }
    );