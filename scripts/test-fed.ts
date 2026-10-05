import * as path from "path";
import * as dotenv from "dotenv";

import { FedPatPolizaState } from "../src/companias/fed-pat/models/fedPatPolizaState";
import {
    FedPatFeedDiario,
    FedPatPolizaStateService
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import { FedPatAuthService } from "../src/companias/fed-pat/services/fedPatAuthService";
import { FedPatCertificadosService } from "../src/companias/fed-pat/services/fedPatCertificadosService";
import { FedPatCertificadosEndososService } from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";
import { FedPatCertificadosSumasService } from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";
import { FedPatProductosDatosService } from "../src/companias/fed-pat/services/fedPatProductosDatosService";
import { FedPatRiesgosCubiertosService } from "../src/companias/fed-pat/services/fedPatRiesgosCubiertosService";
import { FedPatCertificadosComponentesService } from "../src/companias/fed-pat/services/fedPatCertificadosComponentesService";

import { FedPatFacturacionService } from "../src/companias/fed-pat/services/fedPatFacturacionService";
import { FedPatImportesService } from "../src/companias/fed-pat/services/fedPatImportesService";

import { DateUtils } from "../src/utils/dateUtils";


/**
 * Diagnóstico puntual de pólizas de Federación Patronal.
 *
 * Objetivos:
 *
 * 1. Revisar por qué algunas pólizas presentan una fecha de
 *    refacturación aparentemente desactualizada.
 *
 * 2. Revisar pólizas cuya próxima refacturación coincide con
 *    el final de la vigencia contractual.
 *
 * 3. Revisar por qué determinadas pólizas FLOTA no permiten
 *    obtener prima/premio anual y terminan mostrándose en $0.
 *
 * IMPORTANTE:
 *
 * Este script es exclusivamente diagnóstico.
 * No realiza escrituras en Firestore.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Pólizas específicas detectadas durante la validación visual
 * de los riesgos de Federación Patronal.
 */
const POLIZAS_DIAGNOSTICO = new Set<number>([
    34647213,
    35106410,
    35274952,
    35419968,
    35755751
]);


/**
 * Federación publica información mediante feeds diarios.
 *
 * Reconstruimos el mismo período utilizado por el proceso
 * principal para que el diagnóstico trabaje exactamente con
 * la misma información que produjo los riesgos actuales.
 */
const FECHA_HASTA =
    DateUtils.restarDiasDDMMYYYY(
        DateUtils.formatearFechaDDMMYYYY(new Date()),
        1
    );

const FECHA_DESDE =
    DateUtils.restarDiasDDMMYYYY(
        FECHA_HASTA,
        365
    );


async function main(): Promise<void> {

    console.log("==================================================");
    console.log("DIAGNÓSTICO PÓLIZAS FEDERACIÓN PATRONAL");
    console.log("==================================================");
    console.log(`Período: ${FECHA_DESDE} -> ${FECHA_HASTA}`);
    console.log("");


    /*
     * Todos los servicios utilizan la misma instancia de autenticación.
     */
    const authService = new FedPatAuthService();

    const certificadosService =
        new FedPatCertificadosService(authService);

    const endososService =
        new FedPatCertificadosEndososService(authService);

    const sumasService =
        new FedPatCertificadosSumasService(authService);

    const productosDatosService =
        new FedPatProductosDatosService(authService);

    const riesgosCubiertosService =
        new FedPatRiesgosCubiertosService(authService);

    const componentesService =
        new FedPatCertificadosComponentesService(authService);


    /*
     * StateService reconstruye el estado acumulado de cada póliza
     * a partir de los movimientos diarios.
     */
    const stateService =
        new FedPatPolizaStateService();


    /*
     * Estos son exactamente los servicios utilizados por el flujo
     * productivo para determinar refacturación e importes.
     *
     * De esta manera podemos comparar el resultado calculado con
     * los movimientos RAW que originaron dicho resultado.
     */
    const facturacionService =
        new FedPatFacturacionService();

    const importesService =
        new FedPatImportesService();


    const estados =
        new Map<string, FedPatPolizaState>();

    const fechas =
        DateUtils.generarFechas(
            FECHA_DESDE,
            FECHA_HASTA
        );


    console.log(
        `Días a consultar: ${DateUtils.formatearNumero(fechas.length)}`
    );

    console.log("");
    console.log("Reconstruyendo información...");
    console.log("");


    for (
        let indice = 0;
        indice < fechas.length;
        indice++
    ) {

        /*
         * Con noUncheckedIndexedAccess no asumimos que el índice
         * necesariamente contiene un elemento.
         */
        const fecha = fechas.at(indice);

        if (fecha === undefined) {
            continue;
        }


        console.log(
            `[${indice + 1}/${fechas.length}] ${fecha}`
        );


        const [
            certificados,
            endosos,
            sumas,
            productosDatos,
            riesgosCubiertos,
            componentes
        ] = await Promise.all([

            certificadosService.obtenerCertificados(fecha),

            endososService.obtenerEndosos(fecha),

            sumasService.obtenerCertificadosSumas(fecha),

            productosDatosService.obtenerProductosDatos(fecha),

            riesgosCubiertosService.obtenerRiesgosCubiertos(fecha),

            componentesService.obtenerCertificadosComponentes(fecha)

        ]);


        /*
         * Filtramos antes de acumular.
         *
         * El diagnóstico solamente necesita reconstruir las cinco
         * pólizas seleccionadas. Esto reduce considerablemente el
         * estado mantenido en memoria, aunque las consultas HTTP
         * continúan siendo las mismas.
         */
        const feed: FedPatFeedDiario = {

            fecha,

            certificados: certificados.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            ),

            endosos: endosos.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            ),

            sumas: sumas.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            ),

            productosDatos: productosDatos.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            ),

            riesgosCubiertos: riesgosCubiertos.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            ),

            componentes: componentes.filter(
                item =>
                    POLIZAS_DIAGNOSTICO.has(item.numero_poliza)
            )

        };


        stateService.acumularFeed(
            estados,
            feed
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("RESULTADO DEL DIAGNÓSTICO");
    console.log("==================================================");


    /*
     * Buscamos explícitamente cada póliza solicitada.
     *
     * No recorremos solamente estados.values() porque también
     * queremos detectar si alguna póliza directamente no pudo
     * reconstruirse dentro de la ventana histórica.
     */
    for (const numeroPoliza of POLIZAS_DIAGNOSTICO) {

        const estado =
            Array.from(estados.values()).find(
                item =>
                    item.numeroPoliza === numeroPoliza
            ) ?? null;


        console.log("");
        console.log("");
        console.log("##################################################");
        console.log(`PÓLIZA ${numeroPoliza}`);
        console.log("##################################################");


        if (estado === null) {

            console.log(
                "⚠ No se encontró estado para esta póliza."
            );

            continue;
        }


        /*
         * ---------------------------------------------------------
         * CERTIFICADOS
         * ---------------------------------------------------------
         *
         * Permite comprobar vigencia contractual, estado y productor.
         */
        console.log("");
        console.log("=== CERTIFICADOS ===");

        for (
            const certificado of
            [...estado.certificados].sort(
                (a, b) =>
                    a.certificado - b.certificado
            )
        ) {

            console.log({
                certificado: certificado.certificado,
                estadoCertificado: certificado.estado_certificado,
                fechaEstado: certificado.fecha_estado,
                vigenciaDesde: certificado.vigencia_desde,
                vigenciaHasta: certificado.vigencia_hasta,
                productor: certificado.codigo_productor,
                renovadaPor: certificado.renovada_por,
                renuevaA: certificado.renueva_a,
                tipoFacturacion: certificado.tipo_facturacion,
                cantidadFacturacion: certificado.cant_facturacion
            });
        }


        /*
         * ---------------------------------------------------------
         * ENDOSOS DEL CERTIFICADO 0
         * ---------------------------------------------------------
         *
         * El certificado 0 representa actualmente nuestro certificado
         * principal. Ordenamos cronológicamente por número de endoso
         * para poder observar la secuencia completa de facturación.
         */
        console.log("");
        console.log("=== ENDOSOS CERTIFICADO 0 ===");

        const endososCertificadoCero =
            estado.endosos
                .filter(
                    endoso =>
                        endoso.certificado === 0
                )
                .sort(
                    (a, b) =>
                        a.endoso - b.endoso
                );


        for (const endoso of endososCertificadoCero) {

            console.log({
                certificado: endoso.certificado,
                endoso: endoso.endoso,
                tipoEndoso: endoso.tipo_endoso,
                fechaEmision: endoso.fecha_emision,
                vigenciaDesde: endoso.vigencia_desde,
                vigenciaHasta: endoso.vigencia_hasta,
                prima: endoso.prima,
                codigoProducto: endoso.codigo_producto,
                codigoPlan: endoso.codigo_plan
            });
        }


        /*
         * ---------------------------------------------------------
         * SUMAS
         * ---------------------------------------------------------
         *
         * certificados-sumas es especialmente importante para
         * investigar los $0 observados en el frontend.
         */
        console.log("");
        console.log("=== CERTIFICADOS SUMAS ===");

        const sumasOrdenadas =
            [...estado.sumas].sort(
                (a, b) =>
                    a.certificado - b.certificado
            );


        for (const suma of sumasOrdenadas) {

            console.log({
                certificado: suma.certificado,
                sumaAsegurada: suma.suma_asegurada,
                prima: suma.prima,
                premio: suma.premio
            });
        }


        /*
         * ---------------------------------------------------------
         * RESULTADO DEL SERVICIO DE FACTURACIÓN
         * ---------------------------------------------------------
         *
         * Comparamos directamente la selección del servicio contra
         * la secuencia RAW de endosos mostrada arriba.
         */
        console.log("");
        console.log("=== FACTURACIÓN RESUELTA ===");

        const endosoFacturacion =
            facturacionService.obtenerEndosoFacturacion(
                estado
            );


        if (endosoFacturacion === null) {

            console.log(
                "No se pudo resolver endoso de facturación."
            );

        } else {

            console.log({
                certificado: endosoFacturacion.certificado,
                endoso: endosoFacturacion.endoso,
                tipoEndoso: endosoFacturacion.tipo_endoso,
                fechaEmision: endosoFacturacion.fecha_emision,
                vigenciaDesde: endosoFacturacion.vigencia_desde,
                vigenciaHasta: endosoFacturacion.vigencia_hasta,
                prima: endosoFacturacion.prima,
                codigoProducto: endosoFacturacion.codigo_producto,
                codigoPlan: endosoFacturacion.codigo_plan
            });
        }


        /*
         * ---------------------------------------------------------
         * IMPORTES ANUALIZADOS
         * ---------------------------------------------------------
         *
         * Ejecutamos exactamente el mismo cálculo utilizado por
         * FedPatRiskEngine. Si devuelve null podremos comparar los
         * movimientos anteriores y determinar qué regla no aplica.
         */
        console.log("");
        console.log("=== IMPORTES ANUALIZADOS ===");

        /**
         * Ejecutamos exactamente el mismo cálculo de importes
         * utilizado posteriormente por FedPatRiskEngine.
         */
        const importes =
        importesService.calcularImportesAnuales(
            estado
        );


        console.log({
            primaAnual: importes.primaAnual,
            premioAnual: importes.premioAnual,
            endosoUtilizado: importes.endosoFacturacion === null
                ? null
                : {
                    certificado:
                        importes.endosoFacturacion.certificado,

                    endoso:
                        importes.endosoFacturacion.endoso,

                    tipoEndoso:
                        importes.endosoFacturacion.tipo_endoso,

                    vigenciaDesde:
                        importes.endosoFacturacion.vigencia_desde,

                    vigenciaHasta:
                        importes.endosoFacturacion.vigencia_hasta,

                    prima:
                        importes.endosoFacturacion.prima
                }
        });


        /*
         * ---------------------------------------------------------
         * RESUMEN
         * ---------------------------------------------------------
         */
        console.log("");
        console.log("=== RESUMEN ===");

        const certificadoPrincipal =
            estado.certificados.find(
                item =>
                    item.certificado === 0
            ) ?? null;


        console.log({
            numeroPoliza,

            vigenciaContractual:
                certificadoPrincipal === null
                    ? null
                    : {
                        desde:
                            certificadoPrincipal.vigencia_desde,

                        hasta:
                            certificadoPrincipal.vigencia_hasta,

                        vencida:
                            DateUtils.estaVencida(
                                certificadoPrincipal.vigencia_hasta
                            )
                    },

            proximaRefacturacion:
                endosoFacturacion?.vigencia_hasta ?? null,

            primaAnual:
                importes.primaAnual,

            premioAnual:
                importes.premioAnual
        });
    }
}


main().catch(
    (error: unknown) => {

        console.error(
            "Error ejecutando diagnóstico FedPat:",
            error
        );

        process.exit(1);
    }
);