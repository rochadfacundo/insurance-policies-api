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
 * Carga las variables de entorno necesarias para consumir
 * la API de Federación Patronal.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Estructura persistida en el JSON diagnóstico.
 *
 * Conservamos solamente información útil para estudiar la relación
 * entre estado_certificado y el último movimiento del certificado 0.
 *
 * No representa un modelo de dominio ni debe utilizarse en producción.
 */
interface DiagnosticoEstadoCertificado {
    ramo: number;
    numeroPoliza: number;
    estadoCertificado: number;
    fechaEstado: string;
    renovacionAutomatica: string;
    vigenciaDesde: string;
    vigenciaHasta: string;
    renuevaA: number | null;
    renovadaPor: number | null;

    ultimoMovimiento: {
        endoso: number;
        tipo: string;
        codigoMotivo: number;
        fechaEmision: string;
        vigenciaDesde: string;
        vigenciaHasta: string;
        prima: number;
    } | null;
}


/**
 * Resumen de una combinación:
 *
 * estado_certificado + tipo_endoso + codigo_motivo_endoso.
 *
 * Esto permitirá detectar concentraciones de determinados movimientos
 * dentro de cada estado sin asumir todavía su significado comercial.
 */
interface ResumenMovimientoEstado {
    estadoCertificado: number;
    tipoMovimiento: string;
    codigoMotivo: number | null;
    cantidad: number;
    porcentajeDentroEstado: number;
}


/**
 * Obtiene el certificado principal de una póliza.
 *
 * El certificado 0 se utiliza como cabecera contractual para
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
 * Obtiene el último endoso conocido del certificado principal.
 *
 * La selección se realiza por número de endoso y no por posición
 * del array para evitar depender del orden recibido desde la API.
 */
function obtenerUltimoMovimiento(
    estado: FedPatPolizaState
): FedPatCertificadoEndoso | null {

    const movimientos =
        estado.endosos
            .filter(
                endoso =>
                    endoso.certificado === 0
            )
            .sort(
                (a, b) =>
                    b.endoso - a.endoso
            );

    return (
        movimientos.at(0) ??
        null
    );
}


/**
 * Normaliza el tipo de endoso exclusivamente para el análisis.
 *
 * Cuando no existe un movimiento se utiliza "SIN_MOVIMIENTO"
 * para que esos casos también aparezcan en las estadísticas.
 */
function normalizarTipoMovimiento(
    movimiento: FedPatCertificadoEndoso | null
): string {

    if (movimiento === null) {
        return "SIN_MOVIMIENTO";
    }

    const tipo =
        movimiento.tipo_endoso
            ?.trim()
            .toUpperCase();

    return (
        tipo && tipo.length > 0
            ? tipo
            : "SIN_TIPO"
    );
}


/**
 * Diagnóstico estadístico de estado_certificado.
 *
 * Reconstruye certificados y endosos de toda la cartera durante
 * el período histórico y cruza cada estado con el último movimiento
 * conocido del certificado principal.
 *
 * Objetivo:
 *
 * - detectar patrones entre estado_certificado y tipos de endoso;
 * - investigar especialmente estados 1, 11 y 22;
 * - obtener evidencia empírica antes de incorporar reglas de negocio.
 *
 * El detalle completo se persiste en JSON.
 * No utiliza repositorios ni escribe en Firestore.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO ESTADO_CERTIFICADO FEDPAT"
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
     * Utilizamos el mismo rango de 366 días de los diagnósticos
     * anteriores para mantener comparabilidad entre resultados.
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
     * Reconstruimos certificados y endosos de toda la cartera.
     *
     * No necesitamos sumas, productos, riesgos ni componentes
     * para estudiar estado_certificado.
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
     * Generamos una estructura plana para poder inspeccionarla
     * fácilmente desde el JSON sin depender de los modelos internos.
     */
    const diagnosticos:
        DiagnosticoEstadoCertificado[] = [];


    for (const estado of estados.values()) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );

        if (certificado === null) {
            continue;
        }


        const ultimoMovimiento =
            obtenerUltimoMovimiento(
                estado
            );


        diagnosticos.push({
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

            ultimoMovimiento:
                ultimoMovimiento === null
                    ? null
                    : {
                        endoso:
                            ultimoMovimiento.endoso,

                        tipo:
                            normalizarTipoMovimiento(
                                ultimoMovimiento
                            ),

                        codigoMotivo:
                            ultimoMovimiento.codigo_motivo_endoso,

                        fechaEmision:
                            ultimoMovimiento.fecha_emision,

                        vigenciaDesde:
                            ultimoMovimiento.vigencia_desde,

                        vigenciaHasta:
                            ultimoMovimiento.vigencia_hasta,

                        prima:
                            ultimoMovimiento.prima
                    }
        });
    }


    /**
     * Orden estable para facilitar búsquedas y comparaciones
     * manuales dentro del archivo generado.
     */
    diagnosticos.sort(
        (a, b) => {

            if (
                a.estadoCertificado !==
                b.estadoCertificado
            ) {

                return (
                    a.estadoCertificado -
                    b.estadoCertificado
                );
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
            "fedpat-estados-certificados.json"
        );


    guardarJson(
        diagnosticos,
        rutaDetalle
    );


    /**
     * Contabilizamos primero cuántos certificados existen
     * dentro de cada estado.
     */
    const cantidadPorEstado =
        new Map<number, number>();


    for (const diagnostico of diagnosticos) {

        const cantidad =
            cantidadPorEstado.get(
                diagnostico.estadoCertificado
            ) ?? 0;


        cantidadPorEstado.set(
            diagnostico.estadoCertificado,
            cantidad + 1
        );
    }


    /**
     * Agrupamos por:
     *
     * estado_certificado + tipo último movimiento + motivo.
     *
     * Es importante incluir el tipo porque el catálogo de motivos
     * demostró que un mismo codigo_motivo puede tener significados
     * diferentes según el tipo de endoso.
     */
    const movimientosAgrupados =
        new Map<
            string,
            {
                estadoCertificado: number;
                tipoMovimiento: string;
                codigoMotivo: number | null;
                cantidad: number;
            }
        >();


    for (const diagnostico of diagnosticos) {

        const tipoMovimiento =
            diagnostico.ultimoMovimiento
                ?.tipo ??
            "SIN_MOVIMIENTO";

        const codigoMotivo =
            diagnostico.ultimoMovimiento
                ?.codigoMotivo ??
            null;


        const clave =
            `${diagnostico.estadoCertificado}` +
            `|${tipoMovimiento}` +
            `|${codigoMotivo ?? "NULL"}`;


        const existente =
            movimientosAgrupados.get(
                clave
            );


        if (existente !== undefined) {

            existente.cantidad++;

            continue;
        }


        movimientosAgrupados.set(
            clave,
            {
                estadoCertificado:
                    diagnostico.estadoCertificado,

                tipoMovimiento,

                codigoMotivo,

                cantidad:
                    1
            }
        );
    }


    /**
     * Calculamos porcentajes dentro de cada estado.
     *
     * Esto permite detectar, por ejemplo, si un estado está
     * fuertemente asociado a A/219 u otro movimiento específico.
     */
    const resumen:
        ResumenMovimientoEstado[] =
        Array.from(
            movimientosAgrupados.values()
        )
            .map(
                grupo => {

                    const totalEstado =
                        cantidadPorEstado.get(
                            grupo.estadoCertificado
                        ) ?? 0;


                    const porcentajeDentroEstado =
                        totalEstado > 0
                            ? (
                                grupo.cantidad /
                                totalEstado
                            ) * 100
                            : 0;


                    return {
                        ...grupo,

                        porcentajeDentroEstado:
                            Number(
                                porcentajeDentroEstado
                                    .toFixed(2)
                            )
                    };
                }
            )
            .sort(
                (a, b) => {

                    if (
                        a.estadoCertificado !==
                        b.estadoCertificado
                    ) {

                        return (
                            a.estadoCertificado -
                            b.estadoCertificado
                        );
                    }

                    return (
                        b.cantidad -
                        a.cantidad
                    );
                }
            );


    const rutaResumen =
        path.resolve(
            process.cwd(),
            "fedpat-estados-resumen.json"
        );


    guardarJson(
        resumen,
        rutaResumen
    );


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "DISTRIBUCIÓN GENERAL"
    );

    console.log(
        "=================================================="
    );


    const estadosOrdenados =
        Array.from(
            cantidadPorEstado.entries()
        )
            .sort(
                ([estadoA], [estadoB]) =>
                    estadoA - estadoB
            );


    for (
        const [
            estadoCertificado,
            cantidad
        ] of estadosOrdenados
    ) {

        console.log({
            estadoCertificado,
            cantidad
        });
    }


    /**
     * Para no inundar la consola mostramos únicamente las
     * combinaciones más frecuentes de cada estado.
     *
     * El detalle completo queda disponible en los JSON.
     */
    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "TOP MOVIMIENTOS POR ESTADO"
    );

    console.log(
        "=================================================="
    );


    for (
        const [
            estadoCertificado,
            cantidad
        ] of estadosOrdenados
    ) {

        console.log("");
        console.log(
            `ESTADO ${estadoCertificado} - ${cantidad} pólizas`
        );


        const principales =
            resumen
                .filter(
                    item =>
                        item.estadoCertificado ===
                        estadoCertificado
                )
                .slice(
                    0,
                    10
                );


        for (const item of principales) {

            console.log({
                tipo:
                    item.tipoMovimiento,

                codigoMotivo:
                    item.codigoMotivo,

                cantidad:
                    item.cantidad,

                porcentaje:
                    `${item.porcentajeDentroEstado}%`
            });
        }
    }


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "RESUMEN"
    );

    console.log(
        "=================================================="
    );


    console.log({
        estadosReconstruidos:
            estados.size,

        certificadosAnalizados:
            diagnosticos.length,

        estadosCertificado:
            estadosOrdenados.length,

        archivoDetalle:
            rutaDetalle,

        archivoResumen:
            rutaResumen,

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
                "Error ejecutando diagnóstico de estado_certificado:",
                error
            );

            process.exit(1);
        }
    );