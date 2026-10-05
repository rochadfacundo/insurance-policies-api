/* eslint-disable max-len */

import * as dotenv from "dotenv";
import * as path from "path";

import { FedPatAuthService } from "../src/companias/fed-pat/services/fedPatAuthService";
import { FedPatCertificadosService } from "../src/companias/fed-pat/services/fedPatCertificadosService";
import { FedPatCertificadosEndososService } from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";
import { FedPatCertificadosSumasService } from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";

import {
    FedPatPolizaStateService,
    FedPatFeedDiario
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import {
    FedPatImportesService
} from "../src/companias/fed-pat/services/fedPatImportesService";

import {
    FedPatPolizaState
} from "../src/companias/fed-pat/models/fedPatPolizaState";

import { DateUtils } from "../src/utils/dateUtils";


/*
 * El script se ejecuta desde Polizas/, mientras que las variables
 * utilizadas por los servicios de Federación Patronal se encuentran
 * en el .env del proyecto.
 */
dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});


/**
 * Pólizas actualmente vigentes que queremos utilizar para validar
 * exclusivamente el cálculo económico de facturación T/2.
 *
 * 34647213 se incluye deliberadamente como caso de control:
 * su certificado 0 posee importes consolidados en cero, por lo que
 * esperamos que FedPatImportesService devuelva null/null.
 */
const POLIZAS_DIAGNOSTICO = new Set<number>([
    34647213,
    34984341,
    35106410,
    35274952,
    35419968,
    35755751
]);


/**
 * Obtiene el certificado principal de una póliza.
 *
 * En la integración actual de Federación Patronal utilizamos
 * certificado 0 como cabecera contractual de la póliza.
 */
function obtenerCertificadoPrincipal(
    estado: FedPatPolizaState
) {
    return (
        estado.certificados.find(
            certificado => certificado.certificado === 0
        ) ?? null
    );
}


/**
 * Formatea un importe únicamente para facilitar la lectura
 * del diagnóstico en consola.
 */
function formatearImporte(
    importe: number | null
): string {

    if (importe === null) {
        return "null";
    }

    return importe.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


/**
 * Ejecuta una reconstrucción histórica mínima de las pólizas objetivo.
 *
 * Este script:
 *
 * - NO consulta productores;
 * - NO consulta clientes;
 * - NO ejecuta RiskEngine;
 * - NO utiliza mapper;
 * - NO escribe Firestore.
 *
 * Solamente reconstruye los datos necesarios para ejecutar
 * FedPatImportesService sobre las pólizas T/2 seleccionadas.
 */
async function main(): Promise<void> {

    console.log("==================================================");
    console.log("TEST IMPORTES FEDERACIÓN PATRONAL - T/2");
    console.log("==================================================");

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

    const importesService =
        new FedPatImportesService();


    /*
     * Reconstruimos 365 días porque todas las pólizas actuales
     * seleccionadas comenzaron dentro de esta ventana.
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


    for (const fecha of fechas) {

        /*
         * Los tres endpoints son independientes entre sí, por lo que
         * pueden consultarse concurrentemente para reducir el tiempo
         * total del diagnóstico.
         */
        const [
            certificados,
            endosos,
            sumas
        ] = await Promise.all([
            certificadosService.obtenerCertificados(fecha),
            endososService.obtenerEndosos(fecha),
            sumasService.obtenerCertificadosSumas(fecha)
        ]);


        /*
         * Filtramos antes de acumular para evitar reconstruir miles
         * de pólizas que no forman parte de esta prueba.
         */
        const certificadosFiltrados =
            certificados.filter(
                certificado =>
                    POLIZAS_DIAGNOSTICO.has(
                        certificado.numero_poliza
                    )
            );

        const endososFiltrados =
            endosos.filter(
                endoso =>
                    POLIZAS_DIAGNOSTICO.has(
                        endoso.numero_poliza
                    )
            );

        const sumasFiltradas =
            sumas.filter(
                suma =>
                    POLIZAS_DIAGNOSTICO.has(
                        suma.numero_poliza
                    )
            );


        /*
         * El StateService espera el feed diario completo de los
         * endpoints que forman parte de FedPatFeedDiario.
         *
         * Para esta prueba los feeds que no intervienen en el cálculo
         * de importes se envían vacíos deliberadamente.
         */
        const feed: FedPatFeedDiario = {
            fecha,
            certificados: certificadosFiltrados,
            endosos: endososFiltrados,
            sumas: sumasFiltradas,
            productosDatos: [],
            riesgosCubiertos: [],
            componentes: []
        };

        stateService.acumularFeed(
            estados,
            feed
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("RESULTADOS");
    console.log("==================================================");


    for (const numeroPoliza of POLIZAS_DIAGNOSTICO) {

        /*
         * La clave utilizada por FedPatPolizaStateService combina
         * ramo y número de póliza. Las pólizas bajo análisis
         * corresponden al ramo Automotores (4).
         */
        const clave =
            `4-${numeroPoliza}`;

        const estado =
            estados.get(clave) ?? null;


        console.log("");
        console.log("------------------------------------------");
        console.log(`PÓLIZA ${numeroPoliza}`);
        console.log("------------------------------------------");


        if (estado === null) {
            console.log("Estado: NO ENCONTRADO");
            continue;
        }


        const certificadoPrincipal =
            obtenerCertificadoPrincipal(
                estado
            );


        if (certificadoPrincipal === null) {
            console.log(
                "Certificado principal: NO ENCONTRADO"
            );
            continue;
        }


        const sumaPrincipal =
            estado.sumas.find(
                suma => suma.certificado === 0
            ) ?? null;


        const importes =
            importesService.calcularImportesAnuales(
                estado
            );


        console.log("FACTURACIÓN:");
        console.log({
            tipo:
                certificadoPrincipal.tipo_facturacion,
            cantidad:
                certificadoPrincipal.cant_facturacion,
            vigenciaDesde:
                certificadoPrincipal.vigencia_desde,
            vigenciaHasta:
                certificadoPrincipal.vigencia_hasta
        });


        console.log("");
        console.log("CERTIFICADOS-SUMAS / CERTIFICADO 0:");

        if (sumaPrincipal === null) {

            console.log("No encontrado");

        } else {

            console.log({
                prima: sumaPrincipal.prima,
                primaFormateada:
                    sumaPrincipal.prima === null
                        ? "null"
                        : formatearImporte(
                            sumaPrincipal.prima
                        ),

                premio: sumaPrincipal.premio,
                premioFormateado:
                    sumaPrincipal.premio === null
                        ? "null"
                        : formatearImporte(
                            sumaPrincipal.premio
                        )
            });
        }


        console.log("");
        console.log("RESULTADO FedPatImportesService:");

        console.log({
            primaAnual:
                importes.primaAnual,

            primaAnualFormateada:
                formatearImporte(
                    importes.primaAnual
                ),

            premioAnual:
                importes.premioAnual,

            premioAnualFormateado:
                formatearImporte(
                    importes.premioAnual
                ),

            endosoFacturacion:
                importes.endosoFacturacion === null
                    ? null
                    : {
                        endoso:
                            importes
                                .endosoFacturacion
                                .endoso,

                        tipo:
                            importes
                                .endosoFacturacion
                                .tipo_endoso,

                        vigenciaDesde:
                            importes
                                .endosoFacturacion
                                .vigencia_desde,

                        vigenciaHasta:
                            importes
                                .endosoFacturacion
                                .vigencia_hasta
                    }
        });
    }


    console.log("");
    console.log("==================================================");
    console.log("FIN DEL TEST");
    console.log("==================================================");
}


main()
    .catch(error => {
        console.error(
            "Error ejecutando test de importes T/2:",
            error
        );

        process.exit(1);
    });