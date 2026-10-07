import * as path from "path";
import * as dotenv from "dotenv";

import {
    FedPatAuthService
} from "../src/companias/fed-pat/services/fedPatAuthService";

import {
    FedPatCertificadosService
} from "../src/companias/fed-pat/services/fedPatCertificadosService";

import {
    FedPatCertificadosEndososService
} from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";

import {
    FedPatCertificadosSumasService
} from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";

import {
    FedPatMotivosEndosoService
} from "../src/companias/fed-pat/services/fedPatMotivosEndosoService";

import {
    DateUtils
} from "../src/utils/dateUtils";


/**
 * Diagnóstico histórico de la póliza que Técnica informó como ANULADA.
 *
 * Objetivo:
 * determinar qué información devuelve Federación Patronal que permita
 * identificar técnicamente la anulación de la póliza 35755751.
 *
 * IMPORTANTE:
 * - No escribe en Firestore.
 * - No modifica el estado de ninguna póliza.
 * - Solamente consulta información RAW de Federación Patronal.
 */
dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});


const POLIZA_OBJETIVO = 35755751;

const FECHA_HASTA = DateUtils.restarDiasDDMMYYYY(
    DateUtils.formatearFechaDDMMYYYY(new Date()),
    1
);

const FECHA_DESDE = DateUtils.restarDiasDDMMYYYY(
    FECHA_HASTA,
    365
);


/**
 * Punto de entrada del diagnóstico.
 *
 * Se recorren los últimos 365 días de movimientos y se conservan
 * exclusivamente certificados, endosos y sumas pertenecientes a la
 * póliza objetivo.
 *
 * También se consulta el catálogo de motivos de endoso para mostrar
 * la descripción oficial correspondiente a cada tipo/código.
 */
async function main(): Promise<void> {

    const inicio = Date.now();

    console.log("==================================================");
    console.log("DIAGNÓSTICO PÓLIZA ANULADA FEDPAT");
    console.log("==================================================");
    console.log(`Póliza: ${POLIZA_OBJETIVO}`);
    console.log(`Desde: ${FECHA_DESDE}`);
    console.log(`Hasta: ${FECHA_HASTA}`);

    const authService = new FedPatAuthService();

    const certificadosService =
        new FedPatCertificadosService(authService);

    const endososService =
        new FedPatCertificadosEndososService(authService);

    const sumasService =
        new FedPatCertificadosSumasService(authService);

    const motivosService =
        new FedPatMotivosEndosoService(authService);

    const fechas = DateUtils.generarFechas(
        FECHA_DESDE,
        FECHA_HASTA
    );

    /*
     * Se mantienen como arrays RAW porque para este diagnóstico
     * necesitamos observar todos los movimientos históricos y no
     * solamente el estado consolidado final.
     */
    const certificadosObjetivo: Awaited<
        ReturnType<typeof certificadosService.obtenerCertificados>
    > = [];

    const endososObjetivo: Awaited<
        ReturnType<typeof endososService.obtenerEndosos>
    > = [];

    const sumasObjetivo: Awaited<
        ReturnType<typeof sumasService.obtenerCertificadosSumas>
    > = [];

    console.log("");
    console.log(`Días a consultar: ${fechas.length}`);
    console.log("");

    for (let indice = 0; indice < fechas.length; indice++) {

        /*
         * .at() + validación explícita evita propagar undefined
         * con noUncheckedIndexedAccess habilitado.
         */
        const fecha = fechas.at(indice);

        if (fecha === undefined) {
            continue;
        }

        const [
            certificados,
            endosos,
            sumas
        ] = await Promise.all([
            certificadosService.obtenerCertificados(fecha),
            endososService.obtenerEndosos(fecha),
            sumasService.obtenerCertificadosSumas(fecha)
        ]);

        certificadosObjetivo.push(
            ...certificados.filter(
                item => item.numero_poliza === POLIZA_OBJETIVO
            )
        );

        endososObjetivo.push(
            ...endosos.filter(
                item => item.numero_poliza === POLIZA_OBJETIVO
            )
        );

        sumasObjetivo.push(
            ...sumas.filter(
                item => item.numero_poliza === POLIZA_OBJETIVO
            )
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

    /*
     * El catálogo permite interpretar correctamente los motivos.
     *
     * La identidad de un motivo es:
     * tipo de movimiento + código.
     *
     * Por ejemplo, A/2 y N/2 no representan el mismo concepto.
     */
    const motivos = await motivosService.obtenerMotivosEndoso();

    const obtenerDescripcionMotivo = (
        tipo: string,
        codigo: number
    ): string | null => {

        const motivo = motivos.find(
            item =>
                item.tpMotivos === tipo &&
                item.codigo === codigo
        );

        return motivo?.descripcion ?? null;
    };


    console.log("");
    console.log("==================================================");
    console.log("CERTIFICADOS");
    console.log("==================================================");

    /*
     * Mostramos todos los certificados porque una baja puede afectar
     * solamente al certificado principal o también a certificados
     * individuales de una póliza colectiva.
     */
    const certificadosOrdenados = [...certificadosObjetivo].sort(
        (a, b) => a.certificado - b.certificado
    );

    for (const certificado of certificadosOrdenados) {

        console.log({
            certificado: certificado.certificado,
            estadoCertificado: certificado.estado_certificado,
            fechaEstado: certificado.fecha_estado,
            vigenciaDesde: certificado.vigencia_desde,
            vigenciaHasta: certificado.vigencia_hasta,
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
    }


    console.log("");
    console.log("==================================================");
    console.log("ENDOSOS");
    console.log("==================================================");

    /*
     * Ordenamos por certificado y número de endoso para poder leer
     * cronológicamente la historia de cada riesgo/certificado.
     */
    const endososOrdenados = [...endososObjetivo].sort(
        (a, b) => {

            if (a.certificado !== b.certificado) {
                return a.certificado - b.certificado;
            }

            return a.endoso - b.endoso;
        }
    );

    for (const endoso of endososOrdenados) {

        console.log({
            certificado: endoso.certificado,
            endoso: endoso.endoso,
            tipo: endoso.tipo_endoso,
            codigoMotivo:
                endoso.codigo_motivo_endoso,
            descripcionMotivo:
                obtenerDescripcionMotivo(
                    endoso.tipo_endoso,
                    endoso.codigo_motivo_endoso
                ),
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


    console.log("");
    console.log("==================================================");
    console.log("SUMAS");
    console.log("==================================================");

    const sumasOrdenadas = [...sumasObjetivo].sort(
        (a, b) => a.certificado - b.certificado
    );

    for (const suma of sumasOrdenadas) {

        console.log({
            certificado: suma.certificado,
            sumaAsegurada: suma.suma_asegurada,
            prima: suma.prima,
            premio: suma.premio
        });
    }


    console.log("");
    console.log("==================================================");
    console.log("RESUMEN");
    console.log("==================================================");

    console.log({
        certificadosEncontrados:
            certificadosObjetivo.length,
        endososEncontrados:
            endososObjetivo.length,
        sumasEncontradas:
            sumasObjetivo.length,
        duracion:
            DateUtils.formatearDuracion(
                Date.now() - inicio
            )
    });
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