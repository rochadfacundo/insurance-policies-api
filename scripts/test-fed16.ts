
import * as path from "path";
import * as dotenv from "dotenv";

import { FedPatAuthService } from "../src/companias/fed-pat/services/fedPatAuthService";
import { FedPatCertificadosService } from "../src/companias/fed-pat/services/fedPatCertificadosService";
import { FedPatCertificadosEndososService } from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";
import { FedPatCertificadosSumasService } from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";
import { FedPatMotivosEndosoService } from "../src/companias/fed-pat/services/fedPatMotivosEndosoService";
import { FedPatFacturacionService } from "../src/companias/fed-pat/services/fedPatFacturacionService";

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

/**
 * Diagnóstico de refacturación mensual de Federación Patronal.
 *
 * Póliza: 35331993
 *
 * Objetivo:
 * - Identificar la última refacturación emitida.
 * - Verificar sus fechas de emisión y vigencia.
 * - Determinar si el vencimiento del período es 02/11/2026.
 *
 * Solo lectura. No realiza escrituras en Firestore.
 */

const POLIZA_OBJETIVO = 35331993;

// Período acotado para investigar los movimientos de septiembre/octubre.
// Se utiliza un rango fijo para que el diagnóstico sea reproducible.
const FECHA_DESDE = new Date(2026, 8, 1);
const FECHA_HASTA = new Date(2026, 9, 13);

/**
 * Convierte una fecha local a DD/MM/YYYY, formato esperado por FedPat.
 */
function formatearFecha(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
}

/**
 * Genera las fechas diarias inclusivas del intervalo.
 */
function generarFechas(desde: Date, hasta: Date): string[] {
    const fechas: string[] = [];
    const actual = new Date(desde);

    while (actual <= hasta) {
        fechas.push(formatearFecha(actual));
        actual.setDate(actual.getDate() + 1);
    }

    return fechas;
}

async function main(): Promise<void> {

    const authService = new FedPatAuthService();

    const certificadosService = new FedPatCertificadosService(authService);
    const endososService = new FedPatCertificadosEndososService(authService);
    const sumasService = new FedPatCertificadosSumasService(authService);
    const motivosService = new FedPatMotivosEndosoService(authService);

    const fechas = generarFechas(FECHA_DESDE, FECHA_HASTA);

    type Certificado = Awaited<
        ReturnType<typeof certificadosService.obtenerCertificados>
    >[number];

    type Endoso = Awaited<
        ReturnType<typeof endososService.obtenerEndosos>
    >[number];

    type Suma = Awaited<
        ReturnType<typeof sumasService.obtenerCertificadosSumas>
    >[number];

    const certificados = new Map<number, Certificado>();
    const endosos = new Map<string, Endoso>();
    const sumas = new Map<number, Suma>();

    const motivos = await motivosService.obtenerMotivosEndoso();

    console.log("==================================================");
    console.log("DIAGNÓSTICO REFACTURACIÓN MENSUAL");
    console.log("==================================================");
    console.log(`Póliza: ${POLIZA_OBJETIVO}`);
    console.log(`Desde: ${formatearFecha(FECHA_DESDE)}`);
    console.log(`Hasta: ${formatearFecha(FECHA_HASTA)}`);

    for (const [indice, fecha] of fechas.entries()) {

        const [
            certificadosDia,
            endososDia,
            sumasDia
        ] = await Promise.all([
            certificadosService.obtenerCertificados(fecha),
            endososService.obtenerEndosos(fecha),
            sumasService.obtenerCertificadosSumas(fecha)
        ]);

        /*
         * Conservamos el último registro recibido por certificado.
         * El feed puede repetir registros de una misma póliza.
         */
        for (const certificado of certificadosDia) {
            if (certificado.numero_poliza !== POLIZA_OBJETIVO) {
                continue;
            }

            certificados.set(certificado.certificado, certificado);
        }

        /*
         * La identidad de un endoso incluye el certificado.
         * Así evitamos confundir movimientos de distintos riesgos.
         */
        for (const endoso of endososDia) {
            if (endoso.numero_poliza !== POLIZA_OBJETIVO) {
                continue;
            }

            const clave = `${endoso.certificado}_${endoso.endoso}`;
            endosos.set(clave, endoso);
        }

        for (const suma of sumasDia) {
            if (suma.numero_poliza !== POLIZA_OBJETIVO) {
                continue;
            }

            sumas.set(suma.certificado, suma);
        }

        if (
            (indice + 1) % 10 === 0 ||
            indice === fechas.length - 1
        ) {
            console.log(
                `Procesados ${indice + 1}/${fechas.length} días`
            );
        }
    }

    console.log("\n==================================================");
    console.log("CERTIFICADOS");
    console.log("==================================================");

    for (const certificado of certificados.values()) {
        console.log({
            certificado: certificado.certificado,
            estado: certificado.estado_certificado,
            fechaEstado: certificado.fecha_estado,
            vigenciaDesde: certificado.vigencia_desde,
            vigenciaHasta: certificado.vigencia_hasta,
            tipoFacturacion: certificado.tipo_facturacion,
            cantidadFacturacion: certificado.cant_facturacion,
            renovacionAutomatica: certificado.renovacion_aumatica
        });
    }

    console.log("\n==================================================");
    console.log("ENDOSOS / REFACTURACIONES");
    console.log("==================================================");

    const endososOrdenados = [...endosos.values()].sort(
        (a, b) =>
            a.certificado - b.certificado ||
            a.endoso - b.endoso
    );

    for (const endoso of endososOrdenados) {

        const motivo = motivos.find(
            item =>
                item.tpMotivos === endoso.tipo_endoso &&
                item.codigo === endoso.codigo_motivo_endoso
        );

        console.log({
            certificado: endoso.certificado,
            endoso: endoso.endoso,
            tipo: endoso.tipo_endoso,
            codigoMotivo: endoso.codigo_motivo_endoso,
            descripcionMotivo: motivo?.descripcion ?? "SIN DESCRIPCIÓN",
            fechaEmision: endoso.fecha_emision,
            vigenciaDesde: endoso.vigencia_desde,
            vigenciaHasta: endoso.vigencia_hasta,
            prima: endoso.prima
        });
    }

    console.log("\n==================================================");
    console.log("SUMAS CONSOLIDADAS");
    console.log("==================================================");

    for (const suma of sumas.values()) {
        console.log({
            certificado: suma.certificado,
            prima: suma.prima,
            premio: suma.premio,
            sumaAsegurada: suma.suma_asegurada
        });
    }

    /*
     * Diagnóstico preliminar:
     * buscamos el último movimiento de facturación del certificado 0.
     *
     * No convertimos todavía esta observación en una regla de negocio.
     */
    const movimientosFacturacion = endososOrdenados
        .filter(
            item =>
                item.certificado === 0 &&
                ["E", "F", "R"].includes(item.tipo_endoso)
        )
        .sort(
            (a, b) =>
                b.endoso - a.endoso
        );

    const ultimoMovimiento = movimientosFacturacion.at(0) ?? null;

    console.log("\n==================================================");
    console.log("POSIBLE PRÓXIMO VENCIMIENTO");
    console.log("==================================================");

    if (ultimoMovimiento !== null) {
        console.log({
            endoso: ultimoMovimiento.endoso,
            tipo: ultimoMovimiento.tipo_endoso,
            fechaEmision: ultimoMovimiento.fecha_emision,
            inicioPeriodo: ultimoMovimiento.vigencia_desde,
            finPeriodo: ultimoMovimiento.vigencia_hasta,
            posibleProximaRefacturacion:
                ultimoMovimiento.vigencia_hasta
        });
    } else {
        console.log(
            "No se encontraron movimientos E/F/R del certificado principal."
        );
    }

    console.log("\n==================================================");
    console.log("RESUMEN");
    console.log("==================================================");

    console.log({
        certificados: certificados.size,
        endosos: endosos.size,
        sumas: sumas.size
    });

    console.log("\n==================================================");
    console.log("VALIDACIÓN DEL SERVICIO DE FACTURACIÓN");
    console.log("Validación del servicio de facturación con los movimientos obtenidos directamente de Federación Patronal.");
    console.log("==================================================");
    /*
    * Validación del servicio de facturación con los movimientos
    * obtenidos directamente de Federación Patronal.
    *
    * Se reconstruye únicamente la información necesaria para
    * evaluar la próxima fecha de refacturación.
    */
    const facturacionService = new FedPatFacturacionService();

    const estadoDiagnostico = {
        certificados: [...certificados.values()],
        endosos: [...endosos.values()]
    };

    const resultado = facturacionService.obtenerFechaProximaRefacturacion(
        estadoDiagnostico as Parameters<typeof facturacionService.obtenerFechaProximaRefacturacion>[0]);

    console.log("\n==================================================");
    console.log("RESULTADO FEDPAT FACTURACION SERVICE");
    console.log("==================================================");
    console.log(resultado);


}

main().catch((error: unknown) => {
    console.error("Error en diagnóstico FedPat:", error);
    process.exitCode = 1;
});
