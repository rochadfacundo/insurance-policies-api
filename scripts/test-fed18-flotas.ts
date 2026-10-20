
import * as path from "path";
import * as fs from "fs";
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
import { FedPatDatosService } from "../src/companias/fed-pat/services/fedPatDatosService";
import { FedPatTablasService } from "../src/companias/fed-pat/services/fedPatTablasService";
import { FedPatRiskEngine } from "../src/companias/fed-pat/services/fedPatRiskEngine";
import { FedPatPolizaContextService } from "../src/companias/fed-pat/services/fetPatPolizaMapperContext";

import { TipoRiesgo } from "../src/models/TipoRiesgo";
import { DateUtils } from "../src/utils/dateUtils";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const DIAS_PARALELOS = 5;

const FECHA_HASTA = DateUtils.restarDiasDDMMYYYY(
    DateUtils.formatearFechaDDMMYYYY(new Date()),
    1
);

const FECHA_DESDE = DateUtils.restarDiasDDMMYYYY(
    FECHA_HASTA,
    365
);

interface DiagnosticoFlota {
    ramo: number;
    poliza: number;
    certificadosNoCero: number;
    certificadosDistintos: number;
    vehiculosIdentificados: number | null;
    esFlota: boolean;
    diagnostico: string;
}

/**
 * Reconstruye la cartera histórica y compara los certificados
 * acumulados con las flotas detectadas por FedPatRiskEngine.
 *
 * No realiza escrituras en Firestore.
 */
async function main(): Promise<void> {

    const inicio = Date.now();

    console.log("========================================");
    console.log("TEST FED18 - AUDITORÍA DE FLOTAS");
    console.log("========================================");
    console.log(`Período: ${FECHA_DESDE} -> ${FECHA_HASTA}`);

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

    const datosService =
        new FedPatDatosService(authService);

    const tablasService =
        new FedPatTablasService(authService);

    const stateService = new FedPatPolizaStateService();
    const contextService = new FedPatPolizaContextService();
    const riskEngine = new FedPatRiskEngine();

    const estados = new Map<string, FedPatPolizaState>();

    const fechas = DateUtils.generarFechas(
        FECHA_DESDE,
        FECHA_HASTA
    );

    console.log(`Días a consultar: ${fechas.length}`);

    // Reconstrucción cronológica de los siete feeds diarios.
    for (
        let inicioLote = 0;
        inicioLote < fechas.length;
        inicioLote += DIAS_PARALELOS
    ) {

        const fechasLote = fechas.slice(
            inicioLote,
            inicioLote + DIAS_PARALELOS
        );

        const resultadosLote = await Promise.all(
            fechasLote.map(async fecha => {

                const [
                    certificados,
                    endosos,
                    sumas,
                    productosDatos,
                    riesgosCubiertos,
                    componentes,
                    clientes
                ] = await Promise.all([
                    certificadosService.obtenerCertificados(fecha),
                    endososService.obtenerEndosos(fecha),
                    sumasService.obtenerCertificadosSumas(fecha),
                    productosDatosService.obtenerProductosDatos(fecha),
                    riesgosCubiertosService.obtenerRiesgosCubiertos(fecha),
                    componentesService.obtenerCertificadosComponentes(fecha),
                    // El séptimo feed (clientes) no interviene en
                    // la identificación de flotas.
                    Promise.resolve([])
                ]);

                void clientes;

                const feed: FedPatFeedDiario = {
                    fecha,
                    certificados,
                    endosos,
                    sumas,
                    productosDatos,
                    riesgosCubiertos,
                    componentes
                };

                return feed;
            })
        );

        for (const feed of resultadosLote) {
            stateService.acumularFeed(estados, feed);
        }

        const diasProcesados = Math.min(
            inicioLote + fechasLote.length,
            fechas.length
        );

        console.log(
            `[${diasProcesados}/${fechas.length}] ` +
            `Estados: ${estados.size}`
        );
    }

    console.log("\nCartera reconstruida:", estados.size);

    // Catálogos utilizados por el mismo RiskEngine del main.
    const datos = await datosService.obtenerDatos();
    const tablas = await tablasService.obtenerTablas(FECHA_HASTA);

    let sinPrincipal = 0;
    let estado11 = 0;
    let vencidas = 0;
    let elegibles = 0;
    let conMultiplesCertificados = 0;
    let flotasDetectadas = 0;
    let posiblesOmisiones = 0;

    const filas: DiagnosticoFlota[] = [];

    for (const estado of estados.values()) {

        const principal =
            contextService.obtenerCertificadoPrincipal(estado);

        if (principal === null) {
            sinPrincipal++;
            continue;
        }

        if (principal.estado_certificado === 11) {
            estado11++;
            continue;
        }

        if (DateUtils.estaVencida(principal.vigencia_hasta)) {
            vencidas++;
            continue;
        }

        elegibles++;

        // Analizamos únicamente ramos vehiculares.
if (estado.codigoRamo !== 4 && estado.codigoRamo !== 44) {
    continue;
}

        // Certificado 0 representa la cabecera.
        // Contamos los certificados distintos de cero.
        const certificadosNoCero = estado.certificados.filter(
            certificado => certificado.certificado > 0
        );

        const certificadosDistintos = new Set(
            certificadosNoCero.map(c => c.certificado)
        ).size;

        const analisis = riskEngine.analizar(
            estado,
            datos,
            tablas
        );

        const esFlota = analisis.riesgos.includes(
            TipoRiesgo.FLOTA
        );

        if (esFlota) {
            flotasDetectadas++;
        }

        if (certificadosDistintos > 1) {
            conMultiplesCertificados++;
        }

        // No asumimos que cada certificado equivale a un vehículo.
        // Si el análisis no expone vehículos, dejamos null.
        const vehiculosIdentificados =
            "vehiculos" in analisis &&
            Array.isArray(analisis.vehiculos)
                ? analisis.vehiculos.length
                : null;

        const diagnostico = esFlota
            ? "FLOTA_DETECTADA"
            : certificadosDistintos > 1
                ? "REVISAR_MULTIPLES_CERTIFICADOS"
                : "SIN_INDICIO_POR_CERTIFICADOS";

        if (diagnostico === "REVISAR_MULTIPLES_CERTIFICADOS") {
            posiblesOmisiones++;
        }

        if (esFlota || certificadosDistintos > 1) {
            filas.push({
                ramo: estado.codigoRamo,
                poliza: estado.numeroPoliza,
                certificadosNoCero: certificadosNoCero.length,
                certificadosDistintos,
                vehiculosIdentificados,
                esFlota,
                diagnostico
            });
        }
    }

    filas.sort((a, b) =>
        b.certificadosDistintos - a.certificadosDistintos ||
        a.poliza - b.poliza
    );

    // Exportación CSV para revisar todos los casos sospechosos.
    const encabezados = [
        "ramo",
        "poliza",
        "certificadosNoCero",
        "certificadosDistintos",
        "vehiculosIdentificados",
        "esFlota",
        "diagnostico"
    ];

    const escaparCsv = (
        valor: string | number | boolean | null
    ): string => {
        const texto = valor === null ? "" : String(valor);
        return `"${texto.replace(/"/g, '""')}"`;
    };

    const lineas = [
        encabezados.join(";"),
        ...filas.map(fila => [
            fila.ramo,
            fila.poliza,
            fila.certificadosNoCero,
            fila.certificadosDistintos,
            fila.vehiculosIdentificados,
            fila.esFlota,
            fila.diagnostico
        ].map(escaparCsv).join(";"))
    ];

    const archivo = path.resolve(
        process.cwd(),
        "test-fed18-flotas.csv"
    );

    fs.writeFileSync(
        archivo,
        "\uFEFF" + lineas.join("\n"),
        "utf8"
    );

    console.log("\n========================================");
    console.log("RESULTADO AUDITORÍA DE FLOTAS");
    console.log("========================================");

    console.log("Estados reconstruidos:", estados.size);
    console.log("Sin certificado principal:", sinPrincipal);
    console.log("Excluidos por estado 11:", estado11);
    console.log("Excluidos por vigencia vencida:", vencidas);
    console.log("Pólizas elegibles:", elegibles);

    console.log(
        "Pólizas vehiculares con múltiples certificados:",
        conMultiplesCertificados
    );

    console.log(
        "Flotas detectadas por RiskEngine:",
        flotasDetectadas
    );

    console.log(
        "Múltiples certificados SIN FLOTA:",
        posiblesOmisiones
    );

    console.log("\nPrimeros 25 casos sospechosos:");

    console.table(
        filas
            .filter(fila => !fila.esFlota)
            .slice(0, 25)
    );

    console.log("\nCSV generado:", archivo);

    console.log(
        "Duración:",
        DateUtils.formatearDuracion(Date.now() - inicio)
    );

    console.log("No se realizaron escrituras en Firestore.");
}

main().catch((error: unknown) => {
    console.error("Error en auditoría FedPat:", error);
    process.exit(1);
});
