/* eslint-disable max-len */

import * as dotenv from "dotenv";
import * as path from "path";

import { FedPatAuthService }
    from "../src/companias/fed-pat/services/fedPatAuthService";

import { FedPatCertificadosService }
    from "../src/companias/fed-pat/services/fedPatCertificadosService";

import { FedPatCertificadosEndososService }
    from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";

import { FedPatCertificadosSumasService }
    from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";

import {
    FedPatFeedDiario,
    FedPatPolizaStateService
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import { FedPatPolizaState }
    from "../src/companias/fed-pat/models/fedPatPolizaState";

import { DateUtils }
    from "../src/utils/dateUtils";

import { guardarJson }
    from "../src/utils/jsonUtils";


dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Pólizas utilizadas para comparar dos casos con estado_certificado = 11.
 *
 * 34647213:
 * caso ya identificado con movimiento A/219 y reversión de prima.
 *
 * 35419968:
 * caso que hasta ahora se consideraba operativo y que desapareció
 * al aplicar el filtro general por estado 11.
 */
const POLIZAS_OBJETIVO =
    new Set<number>([
        34647213,
        35419968
    ]);


/**
 * Ejecuta un diagnóstico puntual sobre las dos pólizas objetivo.
 *
 * El propósito es comparar su estado contractual, secuencia completa
 * de endosos y evolución de sumas antes de decidir si estado_certificado
 * 11 puede utilizarse por sí solo como criterio de exclusión.
 *
 * El script reconstruye información en memoria y no utiliza Firestore.
 */
async function main(): Promise<void> {

    const inicio = Date.now();

    console.log(
        "=================================================="
    );
    console.log(
        "DIAGNÓSTICO ESTADO 11 - COMPARACIÓN DE CASOS"
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

    const sumasService =
        new FedPatCertificadosSumasService(
            authService
        );

    const stateService =
        new FedPatPolizaStateService();


    /**
     * Conservamos exactamente la misma ventana histórica utilizada
     * por los diagnósticos anteriores para poder comparar resultados.
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

    console.log(`Desde: ${fechaDesde}`);
    console.log(`Hasta: ${fechaHasta}`);
    console.log(`Días: ${fechas.length}`);
    console.log("");


    const estados =
        new Map<string, FedPatPolizaState>();


    /**
     * Reconstruimos certificados, endosos y sumas.
     *
     * No necesitamos productos-datos, componentes ni riesgos cubiertos
     * porque este test estudia exclusivamente el ciclo contractual y
     * económico de las pólizas.
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
            endosos,
            sumas
        ] = await Promise.all([
            certificadosService
                .obtenerCertificados(fecha),

            endososService
                .obtenerEndosos(fecha),

            sumasService
                .obtenerCertificadosSumas(fecha)
        ]);


        /**
         * Filtramos antes de acumular.
         *
         * De esta forma mantenemos en memoria exclusivamente las dos
         * pólizas que queremos comparar, aunque los endpoints diarios
         * devuelvan la cartera completa.
         */
        const certificadosObjetivo =
            certificados.filter(
                item =>
                    POLIZAS_OBJETIVO.has(
                        item.numero_poliza
                    )
            );

        const endososObjetivo =
            endosos.filter(
                item =>
                    POLIZAS_OBJETIVO.has(
                        item.numero_poliza
                    )
            );

        const sumasObjetivo =
            sumas.filter(
                item =>
                    POLIZAS_OBJETIVO.has(
                        item.numero_poliza
                    )
            );


        const feed: FedPatFeedDiario = {
            fecha,
            certificados:
                certificadosObjetivo,

            endosos:
                endososObjetivo,

            sumas:
                sumasObjetivo,

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
                `Procesadas ${indice + 1}/${fechas.length} fechas`
            );
        }
    }


    console.log("");
    console.log(
        `Estados objetivo reconstruidos: ${estados.size}`
    );


    /**
     * Conservamos el estado RAW reconstruido para poder revisar luego
     * cualquier campo que no hayamos mostrado inicialmente por consola.
     */
    const estadosObjetivo =
        Array.from(
            estados.values()
        )
            .sort(
                (a, b) =>
                    a.numeroPoliza -
                    b.numeroPoliza
            );


    const rutaJson =
        path.resolve(
            process.cwd(),
            "fedpat-estado-11-comparacion.json"
        );


    guardarJson(
        estadosObjetivo,
        rutaJson
    );


    for (const estado of estadosObjetivo) {

        const certificado =
            estado.certificados.find(
                item =>
                    item.certificado === 0
            ) ?? null;


        console.log("");
        console.log(
            "=================================================="
        );

        console.log(
            `PÓLIZA ${estado.numeroPoliza}`
        );

        console.log(
            "=================================================="
        );


        if (certificado === null) {

            console.log(
                "Sin certificado principal."
            );

            continue;
        }


        console.log("");
        console.log("CERTIFICADO PRINCIPAL");

        console.log({
            ramo:
                certificado.codigo_ramo,

            numeroPoliza:
                certificado.numero_poliza,

            certificado:
                certificado.certificado,

            estadoCertificado:
                certificado.estado_certificado,

            fechaEstado:
                certificado.fecha_estado,

            vigenciaDesde:
                certificado.vigencia_desde,

            vigenciaHasta:
                certificado.vigencia_hasta,

            renovacionAutomatica:
                certificado.renovacion_aumatica,

            tipoFacturacion:
                certificado.tipo_facturacion,

            cantidadFacturacion:
                certificado.cant_facturacion,

            renuevaA:
                certificado.renueva_a,

            renovadaPor:
                certificado.renovada_por
        });


        /**
         * Mostramos todos los endosos del certificado principal.
         *
         * El orden por número de endoso permite observar la secuencia
         * contractual completa disponible en nuestra ventana histórica.
         */
        const endososCertificado0 =
            estado.endosos
                .filter(
                    item =>
                        item.certificado === 0
                )
                .sort(
                    (a, b) =>
                        a.endoso -
                        b.endoso
                );


        console.log("");
        console.log(
            `ENDOSOS CERTIFICADO 0 (${endososCertificado0.length})`
        );


        for (const endoso of endososCertificado0) {

            console.log({
                endoso:
                    endoso.endoso,

                tipo:
                    endoso.tipo_endoso,

                codigoMotivo:
                    endoso.codigo_motivo_endoso,

                fechaEmision:
                    endoso.fecha_emision,

                vigenciaDesde:
                    endoso.vigencia_desde,

                vigenciaHasta:
                    endoso.vigencia_hasta,

                sumaAsegurada:
                    endoso.suma_asegurada,

                prima:
                    endoso.prima,

                codigoProducto:
                    endoso.codigo_producto,

                codigoPlan:
                    endoso.codigo_plan
            });
        }


        /**
         * Las sumas permiten observar el resultado económico consolidado
         * informado por Federación para cada certificado.
         *
         * Esto es especialmente importante para comparar el caso A/219,
         * cuyo resultado económico terminó en cero, contra 35419968.
         */
        const sumasCertificado0 =
            estado.sumas
                .filter(
                    item =>
                        item.certificado === 0
                );


        console.log("");
        console.log(
            `SUMAS CERTIFICADO 0 (${sumasCertificado0.length})`
        );


        for (const suma of sumasCertificado0) {

            console.log({
                sumaAsegurada:
                    suma.suma_asegurada,

                prima:
                    suma.prima,

                premio:
                    suma.premio
            });
        }


        /**
         * Mostramos también movimientos de certificados distintos de cero.
         *
         * En pólizas colectivas/flota estos certificados representan
         * riesgos individuales y pueden aportar contexto sobre si la
         * póliza continúa teniendo actividad operativa.
         */
        const endososOtrosCertificados =
            estado.endosos
                .filter(
                    item =>
                        item.certificado !== 0
                )
                .sort(
                    (a, b) => {

                        if (
                            a.certificado !==
                            b.certificado
                        ) {
                            return (
                                a.certificado -
                                b.certificado
                            );
                        }

                        return (
                            a.endoso -
                            b.endoso
                        );
                    }
                );


        console.log("");
        console.log(
            `ENDOSOS OTROS CERTIFICADOS (${endososOtrosCertificados.length})`
        );


        for (const endoso of endososOtrosCertificados) {

            console.log({
                certificado:
                    endoso.certificado,

                endoso:
                    endoso.endoso,

                tipo:
                    endoso.tipo_endoso,

                codigoMotivo:
                    endoso.codigo_motivo_endoso,

                fechaEmision:
                    endoso.fecha_emision,

                vigenciaDesde:
                    endoso.vigencia_desde,

                vigenciaHasta:
                    endoso.vigencia_hasta,

                prima:
                    endoso.prima
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
        polizasObjetivo:
            Array.from(
                POLIZAS_OBJETIVO
            ),

        estadosReconstruidos:
            estadosObjetivo.length,

        archivo:
            rutaJson,

        duracion:
            DateUtils.formatearDuracion(
                Date.now() - inicio
            )
    });

    console.log(
        "=================================================="
    );
}


main()
    .catch(
        (error: unknown) => {

            console.error(
                "Error ejecutando diagnóstico comparativo:",
                error
            );

            process.exit(1);
        }
    );