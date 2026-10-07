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
 * Cantidad máxima de relaciones de renovación que imprimiremos.
 *
 * El objetivo es obtener una muestra suficientemente grande
 * para detectar el comportamiento de Federación sin generar
 * una salida innecesariamente extensa.
 */
const MAX_CASOS = 20;


/**
 * Obtiene el certificado principal de una póliza.
 *
 * En la integración actual el certificado 0 representa
 * la cabecera contractual de la póliza.
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
 * y los ordena cronológicamente por número de endoso.
 */
function obtenerEndososCertificadoPrincipal(
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
 * Busca el primer movimiento E o R del certificado principal.
 *
 * Este movimiento resulta útil para observar cuándo comenzó
 * efectivamente la póliza renovadora.
 *
 * No se utiliza como regla de negocio: solamente forma parte
 * del diagnóstico histórico.
 */
function obtenerMovimientoInicial(
    estado: FedPatPolizaState
): FedPatCertificadoEndoso | null {

    return (
        obtenerEndososCertificadoPrincipal(
            estado
        )
            .find(
                endoso => {

                    const tipo =
                        endoso.tipo_endoso
                            ?.trim()
                            .toUpperCase();

                    return (
                        tipo === "E" ||
                        tipo === "R"
                    );
                }
            ) ?? null
    );
}


/**
 * Busca el último movimiento F del certificado principal.
 *
 * Para las pólizas T/2 resulta especialmente útil porque permite
 * comparar el final del último período refacturado contra el
 * comienzo de la póliza renovadora.
 */
function obtenerUltimaRefacturacion(
    estado: FedPatPolizaState
): FedPatCertificadoEndoso | null {

    const refacturaciones =
        obtenerEndososCertificadoPrincipal(
            estado
        )
            .filter(
                endoso =>
                    endoso.tipo_endoso
                        ?.trim()
                        .toUpperCase() === "F"
            );

    return (
        refacturaciones.at(-1) ??
        null
    );
}


/**
 * Convierte una fecha YYYY-MM-DD en milisegundos.
 *
 * Se utiliza exclusivamente para calcular diferencias de días
 * entre eventos históricos.
 */
function obtenerTimestamp(
    fecha: string
): number | null {

    const timestamp =
        Date.parse(
            `${fecha}T00:00:00`
        );

    if (Number.isNaN(timestamp)) {
        return null;
    }

    return timestamp;
}


/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD.
 *
 * Un resultado negativo significa que el segundo evento ocurrió
 * antes de la primera fecha.
 */
function calcularDiferenciaDias(
    fechaDesde: string,
    fechaHasta: string
): number | null {

    const desde =
        obtenerTimestamp(
            fechaDesde
        );

    const hasta =
        obtenerTimestamp(
            fechaHasta
        );

    if (
        desde === null ||
        hasta === null
    ) {
        return null;
    }

    const MILISEGUNDOS_DIA =
        1000 * 60 * 60 * 24;

    return Math.round(
        (hasta - desde) /
        MILISEGUNDOS_DIA
    );
}


/**
 * Diagnóstico histórico de renovaciones T/2.
 *
 * El script:
 *
 * 1. reconstruye certificados y endosos de toda la cartera;
 * 2. localiza pólizas T/2;
 * 3. busca otra póliza cuyo renueva_a apunte a la anterior;
 * 4. compara el vencimiento de la póliza anterior con:
 *      - emisión de la nueva póliza;
 *      - inicio de vigencia de la nueva póliza;
 *      - último período F de la póliza anterior;
 * 5. imprime una muestra de renovaciones reales.
 *
 * No utiliza repositorios ni Firestore.
 * Su ejecución es exclusivamente diagnóstica.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO HISTÓRICO RENOVACIONES T/2"
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
     * Reconstruimos los mismos 365 días utilizados actualmente
     * por el proceso productivo.
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
     * Conservamos toda la cartera.
     *
     * Esto es indispensable porque la relación renueva_a
     * se encuentra en la póliza nueva, no necesariamente
     * en la póliza anterior que estamos investigando.
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
     * Construimos un índice:
     *
     * póliza anterior -> estados que declaran renueva_a.
     *
     * No asumimos que exista una única relación. Si aparecieran
     * duplicados o situaciones especiales queremos poder verlos.
     */
    const renovacionesPorPolizaAnterior =
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


        const relacionesExistentes =
            renovacionesPorPolizaAnterior.get(
                certificado.renueva_a
            ) ?? [];


        relacionesExistentes.push(
            estado
        );


        renovacionesPorPolizaAnterior.set(
            certificado.renueva_a,
            relacionesExistentes
        );
    }


    console.log(
        `Pólizas referenciadas mediante renueva_a: ` +
        `${renovacionesPorPolizaAnterior.size}`
    );


    let totalT2 = 0;
    let totalT2ConRenovacion = 0;
    let casosMostrados = 0;


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "RENOVACIONES T/2 ENCONTRADAS"
    );

    console.log(
        "=================================================="
    );


    for (const estadoAnterior of estados.values()) {

        const anterior =
            obtenerCertificadoPrincipal(
                estadoAnterior
            );


        if (anterior === null) {
            continue;
        }


        /**
         * Nos concentramos exclusivamente en T/2:
         *
         * T = COLECT.FLOTA CON REFAC.
         * 2 = dos períodos de facturación.
         */
        if (
            anterior.tipo_facturacion !== "T" ||
            anterior.cant_facturacion !== 2
        ) {
            continue;
        }


        totalT2++;


        const estadosRenovadores =
            renovacionesPorPolizaAnterior.get(
                anterior.numero_poliza
            ) ?? [];


        if (estadosRenovadores.length === 0) {
            continue;
        }


        totalT2ConRenovacion++;


        for (
            const estadoNuevo
            of estadosRenovadores
        ) {

            if (
                casosMostrados >=
                MAX_CASOS
            ) {
                break;
            }


            const nuevo =
                obtenerCertificadoPrincipal(
                    estadoNuevo
                );


            if (nuevo === null) {
                continue;
            }


            const ultimoF =
                obtenerUltimaRefacturacion(
                    estadoAnterior
                );


            const movimientoInicialNuevo =
                obtenerMovimientoInicial(
                    estadoNuevo
                );


            const diasEntreVigencias =
                calcularDiferenciaDias(
                    anterior.vigencia_hasta,
                    nuevo.vigencia_desde
                );


            const diasEmisionAntesVencimiento =
                movimientoInicialNuevo === null
                    ? null
                    : calcularDiferenciaDias(
                        movimientoInicialNuevo.fecha_emision,
                        anterior.vigencia_hasta
                    );


            console.log("");
            console.log(
                "##################################################"
            );

            console.log(
                `CASO ${casosMostrados + 1}`
            );

            console.log(
                "##################################################"
            );


            console.log("");
            console.log(
                "PÓLIZA ANTERIOR"
            );

            console.log({
                ramo:
                    anterior.codigo_ramo,

                numeroPoliza:
                    anterior.numero_poliza,

                estado:
                    anterior.estado_certificado,

                tipoFacturacion:
                    anterior.tipo_facturacion,

                cantidadFacturacion:
                    anterior.cant_facturacion,

                vigenciaDesde:
                    anterior.vigencia_desde,

                vigenciaHasta:
                    anterior.vigencia_hasta,

                renovadaPor:
                    anterior.renovada_por,

                renuevaA:
                    anterior.renueva_a
            });


            console.log("");
            console.log(
                "ÚLTIMA REFACTURACIÓN F"
            );


            if (ultimoF === null) {

                console.log(
                    "No se encontró movimiento F."
                );

            } else {

                console.log({
                    endoso:
                        ultimoF.endoso,

                    fechaEmision:
                        ultimoF.fecha_emision,

                    vigenciaDesde:
                        ultimoF.vigencia_desde,

                    vigenciaHasta:
                        ultimoF.vigencia_hasta,

                    prima:
                        ultimoF.prima
                });
            }


            console.log("");
            console.log(
                "PÓLIZA RENOVADORA"
            );

            console.log({
                ramo:
                    nuevo.codigo_ramo,

                numeroPoliza:
                    nuevo.numero_poliza,

                estado:
                    nuevo.estado_certificado,

                tipoFacturacion:
                    nuevo.tipo_facturacion,

                cantidadFacturacion:
                    nuevo.cant_facturacion,

                vigenciaDesde:
                    nuevo.vigencia_desde,

                vigenciaHasta:
                    nuevo.vigencia_hasta,

                renovadaPor:
                    nuevo.renovada_por,

                renuevaA:
                    nuevo.renueva_a
            });


            console.log("");
            console.log(
                "PRIMER MOVIMIENTO E/R DE LA RENOVADORA"
            );


            if (
                movimientoInicialNuevo ===
                null
            ) {

                console.log(
                    "No se encontró movimiento inicial E/R."
                );

            } else {

                console.log({
                    endoso:
                        movimientoInicialNuevo.endoso,

                    tipo:
                        movimientoInicialNuevo.tipo_endoso,

                    codigoMotivo:
                        movimientoInicialNuevo.codigo_motivo_endoso,

                    fechaEmision:
                        movimientoInicialNuevo.fecha_emision,

                    vigenciaDesde:
                        movimientoInicialNuevo.vigencia_desde,

                    vigenciaHasta:
                        movimientoInicialNuevo.vigencia_hasta,

                    prima:
                        movimientoInicialNuevo.prima
                });
            }


            console.log("");
            console.log(
                "COMPARACIÓN TEMPORAL"
            );

            console.log({
                vencimientoPolizaAnterior:
                    anterior.vigencia_hasta,

                inicioPolizaNueva:
                    nuevo.vigencia_desde,

                diasEntreVigencias,

                fechaEmisionRenovacion:
                    movimientoInicialNuevo
                        ?.fecha_emision ??
                    null,

                diasDesdeEmisionHastaVencimientoAnterior:
                    diasEmisionAntesVencimiento
            });


            casosMostrados++;
        }


        if (
            casosMostrados >=
            MAX_CASOS
        ) {
            break;
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

        totalT2,

        totalT2ConRenovacion,

        casosMostrados,

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
                "Error ejecutando diagnóstico histórico de renovaciones:",
                error
            );

            process.exit(1);
        }
    );