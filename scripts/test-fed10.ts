/* eslint-disable max-len */

import * as dotenv from "dotenv";
import * as path from "path";

import { FedPatAuthService }
    from "../src/companias/fed-pat/services/fedPatAuthService";

import { FedPatCertificadosService }
    from "../src/companias/fed-pat/services/fedPatCertificadosService";

import {
    FedPatFeedDiario,
    FedPatPolizaStateService
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import { FedPatPolizaState }
    from "../src/companias/fed-pat/models/fedPatPolizaState";

import { DateUtils }
    from "../src/utils/dateUtils";


/**
 * Carga las credenciales y configuración necesarias
 * para consumir la API de Federación Patronal.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Obtiene el certificado principal de una póliza.
 *
 * En la integración actual utilizamos certificado 0 como
 * cabecera contractual para analizar vigencia, estado,
 * renovación y modalidad de facturación.
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
 * Diagnóstico específico de los campos de estado de las
 * pólizas T/2.
 *
 * El objetivo es comparar:
 *
 * - estado_certificado
 * - fecha_estado
 * - renovacion_aumatica
 * - vigencia contractual
 * - relaciones de renovación
 *
 * No interpreta todavía los códigos de estado porque no
 * contamos con documentación que confirme su semántica.
 *
 * No escribe información en Firestore.
 */
async function main(): Promise<void> {

    const inicio =
        Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "DIAGNÓSTICO ESTADOS T/2"
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

    const stateService =
        new FedPatPolizaStateService();


    /**
     * Consultamos el mismo período histórico utilizado en
     * los diagnósticos anteriores para poder comparar
     * exactamente las mismas pólizas.
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
     * Para este diagnóstico solamente necesitamos certificados.
     *
     * Los demás feeds se envían vacíos porque no participan
     * del análisis de estado contractual.
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


        const certificados =
            await certificadosService
                .obtenerCertificados(
                    fecha
                );


        const feed: FedPatFeedDiario = {
            fecha,
            certificados,
            endosos: [],
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
     * Conservamos solamente pólizas T/2.
     *
     * T fue confirmado por el catálogo de Federación como
     * "COLECT.FLOTA CON REFAC.".
     */
    const polizasT2 =
        Array.from(
            estados.values()
        )
            .filter(
                estado => {

                    const certificado =
                        obtenerCertificadoPrincipal(
                            estado
                        );

                    return (
                        certificado !== null &&
                        certificado.tipo_facturacion === "T" &&
                        certificado.cant_facturacion === 2
                    );
                }
            )
            .sort(
                (a, b) => {

                    const certificadoA =
                        obtenerCertificadoPrincipal(
                            a
                        );

                    const certificadoB =
                        obtenerCertificadoPrincipal(
                            b
                        );

                    if (
                        certificadoA === null ||
                        certificadoB === null
                    ) {
                        return 0;
                    }

                    return (
                        certificadoA.numero_poliza -
                        certificadoB.numero_poliza
                    );
                }
            );


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        `PÓLIZAS T/2 ENCONTRADAS: ${polizasT2.length}`
    );

    console.log(
        "=================================================="
    );


    /**
     * Agrupamos también por estado para detectar rápidamente
     * si fecha_estado y renovacion_aumatica muestran patrones
     * consistentes dentro de cada código.
     */
    const cantidadPorEstado =
        new Map<number, number>();


    for (const estado of polizasT2) {

        const certificado =
            obtenerCertificadoPrincipal(
                estado
            );

        if (certificado === null) {
            continue;
        }


        const cantidadActual =
            cantidadPorEstado.get(
                certificado.estado_certificado
            ) ?? 0;


        cantidadPorEstado.set(
            certificado.estado_certificado,
            cantidadActual + 1
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

            tipoFacturacion:
                certificado.tipo_facturacion,

            cantidadFacturacion:
                certificado.cant_facturacion,

            renovadaPor:
                certificado.renovada_por,

            renuevaA:
                certificado.renueva_a
        });
    }


    console.log("");
    console.log(
        "=================================================="
    );

    console.log(
        "DISTRIBUCIÓN POR ESTADO_CERTIFICADO"
    );

    console.log(
        "=================================================="
    );


    for (
        const [
            estado,
            cantidad
        ] of cantidadPorEstado.entries()
    ) {

        console.log({
            estadoCertificado:
                estado,

            cantidad
        });
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

        totalT2:
            polizasT2.length,

        estadosCertificado:
            Array.from(
                cantidadPorEstado.keys()
            ),

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
                "Error ejecutando diagnóstico de estados T/2:",
                error
            );

            process.exit(1);
        }
    );