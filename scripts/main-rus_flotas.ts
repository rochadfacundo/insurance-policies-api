import path from "path";
import { RusPropuesta } from "../src/companias/rus/models/rusPropuestasInterfaces";
import { RusCarteraService } from "../src/companias/rus/services/rusCarteraService";
import { guardarJson } from "../src/utils/jsonUtils";



interface MotivosPosibleFlota {
    seccionAutomotores: boolean;
    esFlotaInformado: boolean;
    cantidadVehiculosMayorAUno: boolean;
    textoRelacionadoConFlota: boolean;
}

interface ResultadoDetalleFlota {
    productor: number;

    identificacion: {
        id: number;
        numeroPoliza: number;
        propuesta: number;
        endoso: number;
        renovacion: number;
    };

    parametrosDetalle: {
        primerParametroEnviadoComoRamo: number;
        propuesta: number;
        endoso: number;
        renovacion: number;
    };

    motivos: MotivosPosibleFlota;

    valoresDetectados: {
        numeroSeccion: unknown;
        seccion: unknown;
        esFlota: unknown;
        tipoEsFlota: string;
        cantidadVehiculos: unknown;
        tipoCantidadVehiculos: string;
        vigenciaEstado: unknown;
    };

    propuestaRaw: RusPropuesta;

    detalleRaw: unknown | null;

    errorDetalle: {
        mensaje: string;
        status?: number;
        data?: unknown;
    } | null;
}

const PRODUCTORES = [
    4666

    // Después podemos agregar el resto:
    // 5319,
    // 10715,
    // 8241,
    // 10107,
    // 12165,
    // 7749,
    // 10571
];

const FECHA_DESDE = "2025-08-03";
const FECHA_HASTA = "2026-08-03";

const ARCHIVO_SALIDA = path.resolve(
    process.cwd(),
    "flotas.json"
);

const DEMORA_ENTRE_DETALLES_MS = 500;

function esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
        .trim()
        .toUpperCase();
}

/**
 * Solamente se usa para el diagnóstico.
 *
 * No modifica el valor original recibido desde RUS.
 */
function interpretarBooleano(valor: unknown): boolean {
    if (valor === true) {
        return true;
    }

    if (typeof valor === "number") {
        return valor === 1;
    }

    if (typeof valor === "string") {
        return [
            "TRUE",
            "1",
            "S",
            "SI",
            "SÍ",
            "Y",
            "YES"
        ].includes(normalizarTexto(valor));
    }

    return false;
}

function obtenerCantidadVehiculos(valor: unknown): number {
    const cantidad = Number(valor);

    return Number.isFinite(cantidad)
        ? cantidad
        : 0;
}

function contieneTextoRelacionadoConFlota(
    propuesta: RusPropuesta
): boolean {

    const textos = [
        propuesta.seccion,
        propuesta.cobertura,
        propuesta.interesAsegurable
    ];

    return textos.some(valor => {
        const texto = normalizarTexto(valor);

        return (
            texto.includes("FLOTA") ||
            texto.includes("AUTOMOTOR") ||
            texto.includes("VEHICULO") ||
            texto.includes("VEHÍCULO")
        );
    });
}

function obtenerMotivos(
    propuesta: RusPropuesta
): MotivosPosibleFlota {

    return {
        seccionAutomotores:
            Number(propuesta.numeroSeccion) === 4,

        esFlotaInformado:
            interpretarBooleano(propuesta.esFlota),

        cantidadVehiculosMayorAUno:
            obtenerCantidadVehiculos(
                propuesta.cantidadVehiculos
            ) > 1,

        textoRelacionadoConFlota:
            contieneTextoRelacionadoConFlota(propuesta)
    };
}

function esPosibleFlota(
    propuesta: RusPropuesta
): boolean {

    const motivos = obtenerMotivos(propuesta);

    /*
     * Usamos OR intencionalmente.
     *
     * El objetivo no es aplicar la regla definitiva de negocio,
     * sino recuperar todos los candidatos posibles para inspeccionar
     * el JSON crudo de RUS.
     */
    return (
        motivos.seccionAutomotores ||
        motivos.esFlotaInformado ||
        motivos.cantidadVehiculosMayorAUno ||
        motivos.textoRelacionadoConFlota
    );
}

function obtenerMensajeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

async function diagnosticarProductor(
    carteraService: RusCarteraService,
    productor: number
): Promise<ResultadoDetalleFlota[]> {

    console.log("");
    console.log("==================================================");
    console.log(`DIAGNÓSTICO DE FLOTAS RUS - PRODUCTOR ${productor}`);
    console.log("==================================================");
    console.log({
        fechaDesde: FECHA_DESDE,
        fechaHasta: FECHA_HASTA
    });

    const manager =
        await carteraService.obtenerCarteraPorRango(
            productor,
            FECHA_DESDE,
            FECHA_HASTA
        );

    const propuestas = manager.getPropuestas();

    const posiblesFlotas =
        propuestas.filter(esPosibleFlota);

    console.log("");
    console.log("RESUMEN DE PROPUESTAS");
    console.log({
        productor,
        propuestasTotales: propuestas.length,
        posiblesFlotas: posiblesFlotas.length,
        seccionAutomotores: propuestas.filter(
            (            propuesta: { numeroSeccion: any; }) =>
                Number(propuesta.numeroSeccion) === 4
        ).length,
        esFlotaTrue: propuestas.filter(
            (            propuesta: { esFlota: unknown; }) =>
                interpretarBooleano(propuesta.esFlota)
        ).length,
        cantidadVehiculosMayorAUno: propuestas.filter(
            (            propuesta: { cantidadVehiculos: unknown; }) =>
                obtenerCantidadVehiculos(
                    propuesta.cantidadVehiculos
                ) > 1
        ).length
    });

    console.table(
        posiblesFlotas.map((propuesta: { numeroPoliza: any; propuesta: any; endoso: any; renovacion: any; numeroSeccion: any; seccion: any; esFlota: any; cantidadVehiculos: any; vigenciaEstado: any; }) => ({
            poliza: propuesta.numeroPoliza,
            propuesta: propuesta.propuesta,
            endoso: propuesta.endoso,
            renovacion: propuesta.renovacion,
            numeroSeccion: propuesta.numeroSeccion,
            seccion: propuesta.seccion,
            esFlota: propuesta.esFlota,
            tipoEsFlota: typeof propuesta.esFlota,
            cantidadVehiculos: propuesta.cantidadVehiculos,
            tipoCantidad: typeof propuesta.cantidadVehiculos,
            vigencia: propuesta.vigenciaEstado
        }))
    );

    const resultados: ResultadoDetalleFlota[] = [];

    for (
        let indice = 0;
        indice < posiblesFlotas.length;
        indice++
    ) {
        const propuesta = posiblesFlotas[indice];

        if(!propuesta){
            continue;
        }

        console.log("");
        console.log(
            `[${indice + 1}/${posiblesFlotas.length}] ` +
            `Consultando detalle de póliza ` +
            `${propuesta.numeroPoliza}`
        );

        let detalleRaw: unknown | null = null;

        let errorDetalle:
            ResultadoDetalleFlota["errorDetalle"] = null;

        try {
            detalleRaw =
                await carteraService
                    .obtenerDetalleDePropuesta(propuesta);

        } catch (error: any) {
            errorDetalle = {
                mensaje: obtenerMensajeError(error),
                status: error?.response?.status,
                data: error?.response?.data
            };

            console.error({
                poliza: propuesta.numeroPoliza,
                propuesta: propuesta.propuesta,
                error: errorDetalle
            });
        }

        resultados.push({
            productor,

            identificacion: {
                id: propuesta.id,
                numeroPoliza: propuesta.numeroPoliza,
                propuesta: propuesta.propuesta,
                endoso: propuesta.endoso,
                renovacion: propuesta.renovacion
            },

            /*
             * Actualmente RusCarteraService usa numeroSeccion
             * como primer parámetro del endpoint de detalle.
             *
             * Lo registramos explícitamente para poder verificar
             * si RUS realmente espera sección o ramo.
             */
            parametrosDetalle: {
                primerParametroEnviadoComoRamo:
                    propuesta.numeroSeccion,

                propuesta: propuesta.propuesta,
                endoso: propuesta.endoso,
                renovacion: propuesta.renovacion
            },

            motivos: obtenerMotivos(propuesta),

            valoresDetectados: {
                numeroSeccion: propuesta.numeroSeccion,
                seccion: propuesta.seccion,
                esFlota: propuesta.esFlota,
                tipoEsFlota: typeof propuesta.esFlota,
                cantidadVehiculos:
                    propuesta.cantidadVehiculos,
                tipoCantidadVehiculos:
                    typeof propuesta.cantidadVehiculos,
                vigenciaEstado:
                    propuesta.vigenciaEstado
            },

            propuestaRaw: propuesta,

            detalleRaw,

            errorDetalle
        });

        if (indice < posiblesFlotas.length - 1) {
            await esperar(DEMORA_ENTRE_DETALLES_MS);
        }
    }

    return resultados;
}

async function main(): Promise<void> {
    const inicio = Date.now();

    const carteraService = new RusCarteraService();

    const resultados: ResultadoDetalleFlota[] = [];

    try {
        for (const productor of PRODUCTORES) {
            const resultadosProductor =
                await diagnosticarProductor(
                    carteraService,
                    productor
                );

            resultados.push(...resultadosProductor);

            /*
             * Guardado parcial.
             *
             * Si falla un productor posterior, conservamos todo
             * lo analizado hasta ese momento.
             */
            guardarJson(resultados, ARCHIVO_SALIDA);
        }

        console.log("");
        console.log("==================================================");
        console.log("DIAGNÓSTICO FINALIZADO");
        console.log("==================================================");
        console.log({
            productoresProcesados: PRODUCTORES.length,
            posiblesFlotasGuardadas: resultados.length,
            detallesExitosos: resultados.filter(
                resultado =>
                    resultado.detalleRaw !== null
            ).length,
            detallesConError: resultados.filter(
                resultado =>
                    resultado.errorDetalle !== null
            ).length,
            archivo: ARCHIVO_SALIDA,
            duracionSegundos:
                Math.round((Date.now() - inicio) / 1000)
        });

    } catch (error) {
        /*
         * También guardamos resultados parciales cuando ocurre
         * un error general.
         */
        guardarJson(resultados, ARCHIVO_SALIDA);

        console.error("");
        console.error("=================================");
        console.error("ERROR EN DIAGNÓSTICO DE FLOTAS");
        console.error("=================================");
        console.error(error);

        process.exitCode = 1;
    }
}

main();