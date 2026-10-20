
import * as path from "path";
import * as dotenv from "dotenv";

import { FedPatAuthService } from "../src/companias/fed-pat/services/fedPatAuthService";
import { FedPatCertificadosService } from "../src/companias/fed-pat/services/fedPatCertificadosService";
import { FedPatCertificadosEndososService } from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";
import { FedPatCertificadosSumasService } from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";

import {
    FedPatPolizaStateService,
    FedPatFeedDiario
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import { FedPatFacturacionService } from "../src/companias/fed-pat/services/fedPatFacturacionService";
import { FedPatPolizaState } from "../src/companias/fed-pat/models/fedPatPolizaState";
import { DateUtils } from "../src/utils/dateUtils";

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const FECHA_DESDE = "13/10/2025";
const FECHA_HASTA = "13/10/2026";
const DIAS_PARALELOS = 5;

const POLIZAS = new Set([
    34984341,
    35106410,
    35274952,
    35331993
]);

async function main(): Promise<void> {

    const inicio = Date.now();

    const authService = new FedPatAuthService();
    const certificadosService = new FedPatCertificadosService(authService);
    const endososService = new FedPatCertificadosEndososService(authService);
    const sumasService = new FedPatCertificadosSumasService(authService);

    const stateService = new FedPatPolizaStateService();
    const facturacionService = new FedPatFacturacionService();

    const estados = new Map<string, FedPatPolizaState>();
    const fechas = DateUtils.generarFechas(FECHA_DESDE, FECHA_HASTA);

    console.log("==================================================");
    console.log("DIAGNÓSTICO DE PRÓXIMAS GESTIONES FEDPAT");
    console.log("==================================================");
    console.log(`Período: ${FECHA_DESDE} -> ${FECHA_HASTA}`);
    console.log(`Días: ${fechas.length}`);
    console.log("Sin escrituras en Firestore.");

    /*
     * Consultamos los feeds por lotes concurrentes.
     * La acumulación se realiza en orden cronológico.
     */
    for (
        let inicioLote = 0;
        inicioLote < fechas.length;
        inicioLote += DIAS_PARALELOS
    ) {

        const fechasLote = fechas.slice(
            inicioLote,
            inicioLote + DIAS_PARALELOS
        );

        const resultados = await Promise.all(
            fechasLote.map(async fecha => {

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
                 * Conservamos únicamente los registros de las
                 * cuatro pólizas investigadas.
                 *
                 * Los tres feeds comparten numero_poliza.
                 */
                const certificadosFiltrados = certificados.filter(
                    item => POLIZAS.has(item.numero_poliza)
                );

                const endososFiltrados = endosos.filter(
                    item => POLIZAS.has(item.numero_poliza)
                );

                const sumasFiltradas = sumas.filter(
                    item => POLIZAS.has(item.numero_poliza)
                );

                return {
                    fecha,
                    certificados: certificadosFiltrados,
                    endosos: endososFiltrados,
                    sumas: sumasFiltradas
                };
            })
        );

        /*
         * FedPatPolizaStateService requiere un feed completo.
         * Los catálogos no participan de este diagnóstico.
         */
        for (const resultado of resultados) {

            const feed: FedPatFeedDiario = {
                fecha: resultado.fecha,
                certificados: resultado.certificados,
                endosos: resultado.endosos,
                sumas: resultado.sumas,
                productosDatos: [],
                riesgosCubiertos: [],
                componentes: []
            };

            stateService.acumularFeed(estados, feed);
        }

        const procesados = Math.min(
            inicioLote + fechasLote.length,
            fechas.length
        );

        console.log(`Procesados ${procesados}/${fechas.length} días`);
    }

    console.log("");
    console.log("==================================================");
    console.log("RESULTADOS");
    console.log("==================================================");

    for (const numeroPoliza of POLIZAS) {

        const estado = Array.from(estados.values()).find(
            item => item.numeroPoliza === numeroPoliza
        );

        if (!estado) {
            console.warn(`Póliza ${numeroPoliza}: sin estado reconstruido`);
            continue;
        }

        const certificado = estado.certificados.find(
            item => item.certificado === 0
        );

        const refacturacion =
            facturacionService.obtenerFechaProximaRefacturacion(estado);

        const gestion =
            facturacionService.obtenerProximaGestion(estado);

        console.log("");
        console.log(`PÓLIZA ${numeroPoliza}`);

        console.log({
            tipoFacturacion: certificado?.tipo_facturacion,
            cantidadFacturacion: certificado?.cant_facturacion,
            vigenciaHasta: certificado?.vigencia_hasta,
            refacturacion,
            gestion
        });
    }

    console.log("");
    console.log(
        `Duración: ${DateUtils.formatearDuracion(Date.now() - inicio)}`
    );
}

main().catch((error: unknown) => {
    console.error("Error ejecutando diagnóstico:", error);
    process.exit(1);
});
