/* eslint-disable max-len */

import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";

import { FedPatAuthService }
    from "../src/companias/fed-pat/services/fedPatAuthService";

import { DateUtils }
    from "../src/utils/dateUtils";


/**
 * Carga las variables de entorno utilizadas por la integración
 * con Federación Patronal.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


const POLIZA_DIAGNOSTICO = 34984341;


/**
 * Representa un recibo informado por el endpoint de cartera
 * de Federación Patronal.
 *
 * El modelo se limita inicialmente a los campos documentados
 * por Swagger. Se mantiene local al script porque todavía
 * estamos validando su utilidad para la integración.
 */
interface FedPatRecibo {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    endoso: number;
    fecha_desde: string;
    estado_recibo: string;
    consecutivo_cuota: number;
    numero_anticipo: number;
    prima_pura: number;
    prima: number;
    prima_tradicional: number;
    numero_recibo: number;
}


/**
 * Representa la respuesta documentada por Swagger para
 * una consulta diaria de recibos.
 */
interface FedPatRecibosResponse {
    fecha_solicitada: string;
    fecha_solicitud: string;
    recibos: FedPatRecibo[];
}


/**
 * Consulta el historial diario de recibos de la póliza objetivo.
 *
 * El propósito es verificar si los recibos aportan información
 * temporal adicional sobre facturación, cuotas o futuros períodos.
 *
 * El script es exclusivamente diagnóstico y no escribe en Firestore.
 */
async function main(): Promise<void> {

    const authService =
        new FedPatAuthService();

    const token =
        await authService.getAccessToken();

    const baseUrl =
        process.env.FED_PAT_BASE_URL ??
        "https://api.fedpat.com.ar";


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
        "=================================================="
    );

    console.log(
        "TEST RECIBOS FEDERACIÓN PATRONAL"
    );

    console.log(
        "=================================================="
    );

    console.log(
        `Póliza: ${POLIZA_DIAGNOSTICO}`
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


    /**
     * Utilizamos numero_recibo como identificador para evitar
     * imprimir repetidamente el mismo recibo si Federación lo
     * devuelve en más de un feed diario.
     */
    const recibosEncontrados =
        new Map<number, FedPatRecibo>();


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


        const response =
            await axios.get<FedPatRecibosResponse>(
                `${baseUrl}/v1/cartera/recibos`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    },

                    params: {
                        fecha,
                        tipo: "O"
                    }
                }
            );


        for (const recibo of response.data.recibos) {

            if (
                recibo.numero_poliza !==
                POLIZA_DIAGNOSTICO
            ) {
                continue;
            }

            recibosEncontrados.set(
                recibo.numero_recibo,
                recibo
            );
        }


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
        "=================================================="
    );

    console.log(
        `RECIBOS ENCONTRADOS: ${recibosEncontrados.size}`
    );

    console.log(
        "=================================================="
    );

    console.log("");


    const recibosOrdenados =
        Array.from(
            recibosEncontrados.values()
        )
            .sort(
                (a, b) =>
                    a.fecha_desde.localeCompare(
                        b.fecha_desde
                    )
            );


    for (const recibo of recibosOrdenados) {

        console.log({
            numeroRecibo:
                recibo.numero_recibo,

            ramo:
                recibo.codigo_ramo,

            numeroPoliza:
                recibo.numero_poliza,

            certificado:
                recibo.certificado,

            endoso:
                recibo.endoso,

            fechaDesde:
                recibo.fecha_desde,

            estadoRecibo:
                recibo.estado_recibo,

            consecutivoCuota:
                recibo.consecutivo_cuota,

            numeroAnticipo:
                recibo.numero_anticipo,

            primaPura:
                recibo.prima_pura,

            prima:
                recibo.prima,

            primaTradicional:
                recibo.prima_tradicional
        });

        console.log("");
    }


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
                "Error consultando recibos de Federación:",
                error
            );

            process.exit(1);
        }
    );