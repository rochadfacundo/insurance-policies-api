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
 * Estados que queremos comparar.
 *
 * El diagnóstico anterior mostró una distribución muy diferente
 * entre los estados 1 y 11. Este script estudia el historial
 * completo de movimientos del certificado principal para determinar
 * si existe una asociación consistente entre estado 11 y endosos A.
 *
 * No se asigna todavía un significado comercial a estos códigos.
 */
const ESTADOS_ANALIZAR =
    new Set<number>([
        1,
        11
    ]);


/**
 * Movimiento simplificado utilizado únicamente en los JSON
 * generados por este diagnóstico.
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
 * Detalle completo de una póliza cuyo certificado principal
 * se encuentra actualmente en estado 11.
 *
 * Se conservan todos los movimientos conocidos del certificado 0
 * para poder estudiar posteriormente casos particulares sin volver
 * a consultar la API.
 */
interface DetalleEstado11 {
    ramo: number;
    numeroPoliza: number;

    estadoCertificado: number;
    fechaEstado: string;

    renovacionAutomatica: string;

    vigenciaDesde: string;
    vigenciaHasta: string;

    renuevaA: number | null;
    renovadaPor: number | null;

    tieneMovimientoA: boolean;
    motivosA: number[];

    movimientos: MovimientoDiagnostico[];
}


/**
 * Estadística de un estado de certificado.
 *
 * Las cantidades asociadas a movimientos A se calculan por póliza,
 * no por cantidad de endosos. De esta manera una póliza con varios
 * endosos A cuenta una sola vez dentro de "polizasConMovimientoA".
 */
interface ResumenEstado {
    estadoCertificado: number;

    totalPolizas: number;

    polizasConMovimientoA: number;
    porcentajeConMovimientoA: number;

    polizasSinMovimientoA: number;
    porcentajeSinMovimientoA: number;

    motivosA: {
        codigoMotivo: number;
        cantidadPolizas: number;
        porcentajeDentroEstado: number;
    }[];
}


/**
 * Obtiene el certificado principal de una póliza.
 *
 * La integración utiliza certificado 0 como cabecera contractual
 * para analizar estado, vigencia, renovación y facturación.
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
 * Obtiene todos los movimientos conocidos del certificado principal.
 *
 * Se ordenan por número de endoso para reconstruir cronológicamente
 * la secuencia contractual disponible en el período consultado.
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
 * Normaliza el tipo de endoso recibido desde Federación.
 *
 * La comparación se realiza en mayúsculas y sin espacios para evitar
 * diferencias de formato en los valores provenientes de la API.
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
 * Determina si un movimiento corresponde a un endoso de tipo A.
 *
 * El diagnóstico no interpreta todavía el significado comercial de A;
 * únicamente estudia su correlación con estado_certificado.
 */
function esMovimientoA(
    movimiento: FedPatCertificadoEndoso
): boolean {

    return (
        normalizarTipo(
            movimiento.tipo_endoso
        ) === "A"
    );
}


/**
 * Convierte un endoso al formato reducido utilizado por el JSON
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
 * Calcula un porcentaje evitando divisiones por cero.
 */
function calcularPorcentaje(
    cantidad: number,
    total: number
): number {

    if (total === 0) {
        return 0;
    }

    return Number(
        (
            cantidad /
            total *
            100
        ).toFixed(2)
    );
}


/**
 * Diagnóstico histórico de estados 1 y 11.
 *
 * Reconstruye certificados y endosos de los últimos 366 días y analiza
 * todos los movimientos del certificado principal de cada póliza.
 *
 * Objetivo:
 *
 * - medir cuántas pólizas de cada estado tuvieron algún endoso A;
 * - identificar qué códigos de motivo A aparecen en cada estado;
 * - comparar estadísticamente estados 1 y 11;
 * - conservar el historial completo de las pólizas estado 11.
 *
 * Este script es exclusivamente diagnóstico.
 * No utiliza repositorios ni escribe información en Firestore.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO HISTÓRICO ESTADOS 1 VS 11"
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
     * Mantenemos exactamente la misma ventana histórica utilizada
     * en los diagnósticos anteriores para poder comparar resultados.
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
     * Para este análisis solamente necesitamos certificados y endosos.
     *
     * Ambos endpoints se consultan en paralelo para cada fecha.
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
     * Acumuladores estadísticos por estado_certificado.
     *
     * El Set de motivos evita contar dos veces una misma póliza
     * para un código A aunque tenga múltiples endosos con ese motivo.
     */
    const estadisticas =
        new Map<
            number,
            {
                totalPolizas: number;
                polizasConMovimientoA: number;
                motivosA: Map<number, number>;
            }
        >();


    for (const estado of ESTADOS_ANALIZAR) {

        estadisticas.set(
            estado,
            {
                totalPolizas: 0,
                polizasConMovimientoA: 0,
                motivosA: new Map<number, number>()
            }
        );
    }


    const detalleEstado11:
        DetalleEstado11[] = [];


    for (const estado of estados.values()) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );

        if (certificado === null) {
            continue;
        }


        const codigoEstado =
            certificado.estado_certificado;


        if (
            !ESTADOS_ANALIZAR.has(
                codigoEstado
            )
        ) {
            continue;
        }


        const estadistica =
            estadisticas.get(
                codigoEstado
            );

        if (estadistica === undefined) {
            continue;
        }


        estadistica.totalPolizas++;


        const movimientos =
            obtenerMovimientosCertificadoPrincipal(
                estado
            );


        const movimientosA =
            movimientos.filter(
                esMovimientoA
            );


        if (movimientosA.length > 0) {

            estadistica
                .polizasConMovimientoA++;
        }


        /**
         * Una póliza cuenta como máximo una vez por código de motivo.
         *
         * Ejemplo:
         * si una póliza tuviera dos A/219, para la estadística A/219
         * sigue representando una única póliza.
         */
        const motivosUnicos =
            new Set<number>();


        for (const movimiento of movimientosA) {

            motivosUnicos.add(
                movimiento.codigo_motivo_endoso
            );
        }


        for (const motivo of motivosUnicos) {

            const cantidadActual =
                estadistica.motivosA.get(
                    motivo
                ) ?? 0;


            estadistica.motivosA.set(
                motivo,
                cantidadActual + 1
            );
        }


        /**
         * Conservamos el historial completo únicamente para estado 11.
         *
         * De esta manera podemos investigar después casos particulares
         * sin generar un JSON innecesariamente grande para estado 1.
         */
        if (codigoEstado === 11) {

            detalleEstado11.push({
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

                tieneMovimientoA:
                    movimientosA.length > 0,

                motivosA:
                    Array.from(
                        motivosUnicos
                    )
                        .sort(
                            (a, b) =>
                                a - b
                        ),

                movimientos:
                    movimientos.map(
                        mapearMovimiento
                    )
            });
        }
    }


    /**
     * Construimos un resumen serializable y ordenado.
     */
    const resumen:
        ResumenEstado[] = [];


    for (
        const [
            estadoCertificado,
            estadistica
        ] of estadisticas.entries()
    ) {

        const polizasSinMovimientoA =
            estadistica.totalPolizas -
            estadistica.polizasConMovimientoA;


        const motivosA =
            Array.from(
                estadistica.motivosA.entries()
            )
                .map(
                    ([
                        codigoMotivo,
                        cantidadPolizas
                    ]) => ({
                        codigoMotivo,

                        cantidadPolizas,

                        porcentajeDentroEstado:
                            calcularPorcentaje(
                                cantidadPolizas,
                                estadistica.totalPolizas
                            )
                    })
                )
                .sort(
                    (a, b) =>
                        b.cantidadPolizas -
                        a.cantidadPolizas
                );


        resumen.push({
            estadoCertificado,

            totalPolizas:
                estadistica.totalPolizas,

            polizasConMovimientoA:
                estadistica.polizasConMovimientoA,

            porcentajeConMovimientoA:
                calcularPorcentaje(
                    estadistica.polizasConMovimientoA,
                    estadistica.totalPolizas
                ),

            polizasSinMovimientoA,

            porcentajeSinMovimientoA:
                calcularPorcentaje(
                    polizasSinMovimientoA,
                    estadistica.totalPolizas
                ),

            motivosA
        });
    }


    resumen.sort(
        (a, b) =>
            a.estadoCertificado -
            b.estadoCertificado
    );


    detalleEstado11.sort(
        (a, b) =>
            a.numeroPoliza -
            b.numeroPoliza
    );


    /**
     * Persistimos resultados para poder continuar el análisis
     * sin repetir las 366 consultas diarias.
     */
    const rutaResumen =
        path.resolve(
            process.cwd(),
            "fedpat-historial-estados-resumen.json"
        );


    const rutaDetalleEstado11 =
        path.resolve(
            process.cwd(),
            "fedpat-estado-11-detalle.json"
        );


    guardarJson(
        resumen,
        rutaResumen
    );


    guardarJson(
        detalleEstado11,
        rutaDetalleEstado11
    );


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "COMPARACIÓN ESTADOS 1 VS 11"
    );

    console.log(
        "=================================================="
    );


    for (const estado of resumen) {

        console.log("");
        console.log(
            `ESTADO ${estado.estadoCertificado}`
        );

        console.log({
            totalPolizas:
                estado.totalPolizas,

            polizasConMovimientoA:
                estado.polizasConMovimientoA,

            porcentajeConMovimientoA:
                `${estado.porcentajeConMovimientoA}%`,

            polizasSinMovimientoA:
                estado.polizasSinMovimientoA,

            porcentajeSinMovimientoA:
                `${estado.porcentajeSinMovimientoA}%`
        });


        console.log(
            "Motivos A más frecuentes:"
        );


        for (
            const motivo of
            estado.motivosA.slice(0, 15)
        ) {

            console.log({
                codigoMotivo:
                    motivo.codigoMotivo,

                cantidadPolizas:
                    motivo.cantidadPolizas,

                porcentaje:
                    `${motivo.porcentajeDentroEstado}%`
            });
        }
    }


    /**
     * A/219 es especialmente relevante porque el catálogo confirmó
     * su descripción como falta de pago de prima.
     */
    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "COMPARACIÓN ESPECÍFICA A/219"
    );

    console.log(
        "=================================================="
    );


    for (const estado of resumen) {

        const motivo219 =
            estado.motivosA.find(
                motivo =>
                    motivo.codigoMotivo === 219
            ) ?? null;


        console.log({
            estadoCertificado:
                estado.estadoCertificado,

            polizasConA219:
                motivo219?.cantidadPolizas ?? 0,

            porcentajeDentroEstado:
                motivo219 === null
                    ? "0%"
                    : `${motivo219.porcentajeDentroEstado}%`
        });
    }


    /**
     * Confirmamos explícitamente que la póliza problemática quedó
     * incluida en el detalle diagnóstico.
     */
    const poliza34647213 =
        detalleEstado11.find(
            poliza =>
                poliza.numeroPoliza === 34647213
        ) ?? null;


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "CASO 34647213"
    );

    console.log(
        "=================================================="
    );


    if (poliza34647213 === null) {

        console.log(
            "La póliza 34647213 no fue encontrada dentro del estado 11."
        );

    } else {

        console.log({
            numeroPoliza:
                poliza34647213.numeroPoliza,

            estadoCertificado:
                poliza34647213.estadoCertificado,

            fechaEstado:
                poliza34647213.fechaEstado,

            tieneMovimientoA:
                poliza34647213.tieneMovimientoA,

            motivosA:
                poliza34647213.motivosA,

            cantidadMovimientos:
                poliza34647213.movimientos.length
        });


        console.log(
            "Movimientos:"
        );


        for (
            const movimiento of
            poliza34647213.movimientos
        ) {

            console.log(movimiento);
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

        estadosAnalizados:
            Array.from(
                ESTADOS_ANALIZAR
            ),

        polizasEstado11Guardadas:
            detalleEstado11.length,

        archivoResumen:
            rutaResumen,

        archivoDetalleEstado11:
            rutaDetalleEstado11,

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
                "Error ejecutando diagnóstico histórico de estados:",
                error
            );

            process.exit(1);
        }
    );