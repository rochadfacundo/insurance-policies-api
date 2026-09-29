import * as fs from "fs";
import * as path from "path";


/**
 * Movimiento histórico de endoso almacenado en los diagnósticos
 * D/2 y T/2 generados previamente.
 */
interface EndosoDiagnostico {
    codigoRamo: number;
    numeroPoliza: number;
    certificado: number;
    endoso: number;

    fechaEmision: string | null;

    vigenciaDesde: string | null;
    vigenciaHasta: string | null;

    tipoEndoso: string | null;
    motivoEndoso: number | null;

    prima: number | null;

    duracionDias: number | null;
}


/**
 * Póliza almacenada dentro de los JSON históricos.
 *
 * Importante:
 * los archivos D/2 y T/2 ya fueron construidos a partir de poblaciones
 * previamente filtradas. Por ese motivo cada póliza no necesita guardar
 * nuevamente tipoFacturacion ni cantidadFacturacion.
 */
interface PolizaDiagnostico {
    codigoRamo: number;
    numeroPoliza: number;

    primaInformada: number | null;
    premioInformado: number | null;

    cantidadEndosos?: number;

    endosos: EndosoDiagnostico[];
}


/**
 * Estructura mínima común de los archivos históricos utilizados
 * como entrada del diagnóstico.
 */
interface DiagnosticoEntrada {
    polizas: PolizaDiagnostico[];
}


/**
 * Tipo de facturación conocido a partir del archivo de origen.
 */
type TipoFacturacionDiagnostico = "D" | "T";


/**
 * Asocia una póliza con el esquema de facturación conocido
 * a partir del archivo del cual fue obtenida.
 *
 * - fedpat-d2-365-dias.json -> D/2
 * - fedpat-t2-365-dias.json -> T/2
 */
interface PolizaConFacturacion {
    poliza: PolizaDiagnostico;
    tipoFacturacion: TipoFacturacionDiagnostico;
    cantidadFacturacion: 2;
}


/**
 * Configuración de cada archivo histórico utilizado.
 */
interface FuenteDiagnostico {
    archivo: string;
    tipoFacturacion: TipoFacturacionDiagnostico;
    cantidadFacturacion: 2;
}


/**
 * Fuente seleccionada como posible fallback cuando una póliza
 * todavía no posee una refacturación F positiva.
 */
type FuentePrima =
    | "R"
    | "E"
    | "SIN_CANDIDATO";


/**
 * Resultado del análisis de una póliza que no posee
 * una refacturación F positiva en certificado 0.
 */
interface AnalisisPolizaSinF {
    codigoRamo: number;
    numeroPoliza: number;

    tipoFacturacion: TipoFacturacionDiagnostico;
    cantidadFacturacion: 2;

    primaInformada: number | null;
    premioInformado: number | null;

    movimientosCertificado0: EndosoDiagnostico[];

    movimientosRPositivos: EndosoDiagnostico[];
    movimientosEPositivos: EndosoDiagnostico[];

    candidato: EndosoDiagnostico | null;
    fuenteCandidato: FuentePrima;

    primaPeriodicaCandidata: number | null;
    primaAnualProyectada: number | null;
}


/**
 * Indica si un movimiento posee una prima válida
 * y estrictamente positiva.
 */
function tienePrimaPositiva(
    movimiento: EndosoDiagnostico
): boolean {

    return (
        movimiento.prima !== null &&
        Number.isFinite(movimiento.prima) &&
        movimiento.prima > 0
    );
}


/**
 * Ordena los movimientos por número de endoso.
 *
 * Se devuelve una copia para no modificar el array original
 * almacenado en el diagnóstico.
 */
function ordenarPorEndoso(
    movimientos: EndosoDiagnostico[]
): EndosoDiagnostico[] {

    return [...movimientos]
        .sort(
            (
                a: EndosoDiagnostico,
                b: EndosoDiagnostico
            ) =>
                a.endoso - b.endoso
        );
}


/**
 * Determina si existe al menos una refacturación F positiva
 * dentro de los movimientos analizados.
 */
function tieneFPositivo(
    movimientos: EndosoDiagnostico[]
): boolean {

    return movimientos.some(
        (movimiento: EndosoDiagnostico) =>
            movimiento.tipoEndoso === "F" &&
            tienePrimaPositiva(movimiento)
    );
}


/**
 * Obtiene el último movimiento positivo de un determinado tipo.
 *
 * Se devuelve null explícitamente cuando no existe candidato,
 * evitando propagar undefined con noUncheckedIndexedAccess.
 */
function obtenerUltimoPositivoPorTipo(
    movimientos: EndosoDiagnostico[],
    tipo: string
): EndosoDiagnostico | null {

    const candidatos =
        ordenarPorEndoso(
            movimientos.filter(
                (movimiento: EndosoDiagnostico) =>
                    movimiento.tipoEndoso === tipo &&
                    tienePrimaPositiva(movimiento)
            )
        );

    return candidatos.at(-1) ?? null;
}


/**
 * Selecciona una fuente candidata de prima periódica
 * cuando todavía no existe una refacturación F positiva.
 *
 * Prioridad EXPLORATORIA:
 *
 * 1. R positivo:
 *    el catálogo oficial lo identifica como RENOVACION DE POLIZA.
 *
 * 2. E positivo:
 *    el catálogo oficial lo identifica como EMISION P/COTIZACION.
 *
 * Esta prioridad se utiliza exclusivamente para el diagnóstico.
 * Todavía no representa una regla productiva de anualización.
 */
function seleccionarCandidato(
    movimientos: EndosoDiagnostico[]
): {
    candidato: EndosoDiagnostico | null;
    fuente: FuentePrima;
} {

    const ultimoR =
        obtenerUltimoPositivoPorTipo(
            movimientos,
            "R"
        );


    if (ultimoR !== null) {

        return {
            candidato: ultimoR,
            fuente: "R"
        };
    }


    const ultimoE =
        obtenerUltimoPositivoPorTipo(
            movimientos,
            "E"
        );


    if (ultimoE !== null) {

        return {
            candidato: ultimoE,
            fuente: "E"
        };
    }


    return {
        candidato: null,
        fuente: "SIN_CANDIDATO"
    };
}


/**
 * Proyecta una prima periódica al año utilizando la cantidad
 * de períodos informada por el esquema de facturación.
 *
 * En este diagnóstico solamente trabajamos con D/2 y T/2,
 * por lo que el factor esperado es 2.
 */
function proyectarPrimaAnual(
    primaPeriodica: number | null,
    cantidadFacturacion: number
): number | null {

    if (
        primaPeriodica === null ||
        !Number.isFinite(primaPeriodica) ||
        primaPeriodica <= 0
    ) {
        return null;
    }


    if (
        !Number.isFinite(cantidadFacturacion) ||
        cantidadFacturacion <= 0
    ) {
        return null;
    }


    return (
        primaPeriodica *
        cantidadFacturacion
    );
}


/**
 * Lee un archivo JSON histórico.
 *
 * Devuelve null cuando el archivo no existe para permitir que
 * el diagnóstico informe el problema sin propagar undefined.
 */
function leerDiagnostico(
    archivo: string
): DiagnosticoEntrada | null {

    if (!fs.existsSync(archivo)) {
        return null;
    }


    const contenido =
        fs.readFileSync(
            archivo,
            "utf8"
        );


    const diagnostico: DiagnosticoEntrada =
        JSON.parse(contenido) as DiagnosticoEntrada;


    return diagnostico;
}


/**
 * Construye una clave única para una póliza dentro del diagnóstico.
 *
 * Incluimos el tipo de facturación para evitar una eventual colisión
 * si una misma póliza apareciera tanto en D/2 como en T/2.
 */
function construirClavePoliza(
    tipoFacturacion: TipoFacturacionDiagnostico,
    poliza: PolizaDiagnostico
): string {

    return (
        `${tipoFacturacion}`
        + `-${poliza.codigoRamo}`
        + `-${poliza.numeroPoliza}`
    );
}


/**
 * Devuelve todos los movimientos del certificado principal (0)
 * ordenados por número de endoso.
 */
function obtenerMovimientosCertificado0(
    poliza: PolizaDiagnostico
): EndosoDiagnostico[] {

    const movimientos =
        Array.isArray(poliza.endosos)
            ? poliza.endosos
            : [];


    return ordenarPorEndoso(
        movimientos.filter(
            (movimiento: EndosoDiagnostico) =>
                movimiento.certificado === 0
        )
    );
}


/**
 * Formatea una póliza para mostrarla de manera compacta
 * en las tablas de consola.
 */
function obtenerIdentificadorFacturacion(
    resultado: AnalisisPolizaSinF
): string {

    return (
        `${resultado.tipoFacturacion}`
        + "/"
        + `${resultado.cantidadFacturacion}`
    );
}


/**
 * Punto de entrada del diagnóstico.
 *
 * Objetivo:
 * estudiar qué fuente puede utilizarse como prima periódica cuando
 * una póliza D/2 o T/2 todavía no posee una refacturación F positiva.
 *
 * El script:
 *
 * - utiliza exclusivamente JSON históricos ya generados;
 * - no consulta nuevamente los 365 días de la API;
 * - no modifica Firestore;
 * - no implementa reglas productivas;
 * - estudia R y E como posibles fallback de F.
 */
function main(): void {

    console.log(
        "=================================================="
    );

    console.log(
        "FEDPAT - DIAGNÓSTICO SIN F"
    );

    console.log(
        "=================================================="
    );


    // --------------------------------------------------
    // FUENTES HISTÓRICAS
    // --------------------------------------------------

    const fuentes: FuenteDiagnostico[] = [
        {
            archivo:
                path.resolve(
                    __dirname,
                    "fedpat-d2-365-dias.json"
                ),

            tipoFacturacion:
                "D",

            cantidadFacturacion:
                2
        },

        {
            archivo:
                path.resolve(
                    __dirname,
                    "fedpat-t2-365-dias.json"
                ),

            tipoFacturacion:
                "T",

            cantidadFacturacion:
                2
        }
    ];


    /**
     * Acumulamos las pólizas junto con la facturación conocida
     * a partir del archivo de origen.
     */
    const polizasPorClave =
        new Map<string, PolizaConFacturacion>();


    // --------------------------------------------------
    // CARGAR ARCHIVOS
    // --------------------------------------------------

    for (const fuente of fuentes) {

        const diagnostico =
            leerDiagnostico(
                fuente.archivo
            );


        if (diagnostico === null) {

            console.log(
                `Archivo no encontrado: ${fuente.archivo}`
            );

            continue;
        }


        const polizas: PolizaDiagnostico[] =
            Array.isArray(diagnostico.polizas)
                ? diagnostico.polizas
                : [];


        console.log(
            `Archivo leído: ${path.basename(fuente.archivo)}`
        );

        console.log(
            `Pólizas: ${polizas.length}`
        );


        for (const poliza of polizas) {

            const clave =
                construirClavePoliza(
                    fuente.tipoFacturacion,
                    poliza
                );


            polizasPorClave.set(
                clave,
                {
                    poliza,

                    tipoFacturacion:
                        fuente.tipoFacturacion,

                    cantidadFacturacion:
                        fuente.cantidadFacturacion
                }
            );
        }
    }


    const polizasObjetivo:
        PolizaConFacturacion[] =
        Array.from(
            polizasPorClave.values()
        );


    console.log();

    console.log(
        `Pólizas D/2 o T/2 cargadas: ${polizasObjetivo.length}`
    );


    // --------------------------------------------------
    // ANALIZAR PÓLIZAS SIN F
    // --------------------------------------------------

    const resultados:
        AnalisisPolizaSinF[] = [];


    for (const entrada of polizasObjetivo) {

        const poliza =
            entrada.poliza;


        const movimientosCertificado0 =
            obtenerMovimientosCertificado0(
                poliza
            );


        /**
         * Este diagnóstico solamente estudia el fallback.
         *
         * Si la póliza ya tiene F positivo en certificado 0,
         * queda fuera del análisis.
         */
        if (
            tieneFPositivo(
                movimientosCertificado0
            )
        ) {
            continue;
        }


        const movimientosRPositivos =
            movimientosCertificado0.filter(
                (movimiento: EndosoDiagnostico) =>
                    movimiento.tipoEndoso === "R" &&
                    tienePrimaPositiva(movimiento)
            );


        const movimientosEPositivos =
            movimientosCertificado0.filter(
                (movimiento: EndosoDiagnostico) =>
                    movimiento.tipoEndoso === "E" &&
                    tienePrimaPositiva(movimiento)
            );


        const seleccion =
            seleccionarCandidato(
                movimientosCertificado0
            );


        const primaPeriodicaCandidata =
            seleccion.candidato?.prima ?? null;


        const primaAnualProyectada =
            proyectarPrimaAnual(
                primaPeriodicaCandidata,
                entrada.cantidadFacturacion
            );


        resultados.push({
            codigoRamo:
                poliza.codigoRamo,

            numeroPoliza:
                poliza.numeroPoliza,

            tipoFacturacion:
                entrada.tipoFacturacion,

            cantidadFacturacion:
                entrada.cantidadFacturacion,

            primaInformada:
                poliza.primaInformada,

            premioInformado:
                poliza.premioInformado,

            movimientosCertificado0,

            movimientosRPositivos,

            movimientosEPositivos,

            candidato:
                seleccion.candidato,

            fuenteCandidato:
                seleccion.fuente,

            primaPeriodicaCandidata,

            primaAnualProyectada
        });
    }


    // --------------------------------------------------
    // SEPARAR D/2 Y T/2
    // --------------------------------------------------

    const resultadosD2 =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.tipoFacturacion === "D"
        );


    const resultadosT2 =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.tipoFacturacion === "T"
        );


    // --------------------------------------------------
    // RESUMEN DE CANDIDATOS
    // --------------------------------------------------

    const conR =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.movimientosRPositivos.length > 0
        );


    const conE =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.movimientosEPositivos.length > 0
        );


    const conRYE =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.movimientosRPositivos.length > 0 &&
                resultado.movimientosEPositivos.length > 0
        );


    const candidatosR =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.fuenteCandidato === "R"
        );


    const candidatosE =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.fuenteCandidato === "E"
        );


    const sinCandidato =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.fuenteCandidato ===
                    "SIN_CANDIDATO"
        );


    const primaAlta =
        resultados.filter(
            (resultado: AnalisisPolizaSinF) =>
                resultado.primaAnualProyectada !== null &&
                resultado.primaAnualProyectada >=
                    5_000_000
        );


    const resumen = {

        poblacion: {
            totalD2T2:
                polizasObjetivo.length,

            d2:
                polizasObjetivo.filter(
                    (entrada: PolizaConFacturacion) =>
                        entrada.tipoFacturacion === "D"
                ).length,

            t2:
                polizasObjetivo.filter(
                    (entrada: PolizaConFacturacion) =>
                        entrada.tipoFacturacion === "T"
                ).length
        },

        sinFPositivo: {
            total:
                resultados.length,

            d2:
                resultadosD2.length,

            t2:
                resultadosT2.length
        },

        fallback: {
            conRPositivo:
                conR.length,

            conEPositivo:
                conE.length,

            conRPositivoYPositivoE:
                conRYE.length,

            candidatoR:
                candidatosR.length,

            candidatoE:
                candidatosE.length,

            sinCandidato:
                sinCandidato.length
        },

        proyeccion: {
            primaMayorIgual5M:
                primaAlta.length
        }
    };


    // --------------------------------------------------
    // MOSTRAR RESUMEN
    // --------------------------------------------------

    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "RESUMEN"
    );

    console.log(
        "=================================================="
    );


    console.dir(
        resumen,
        {
            depth: null
        }
    );


    // --------------------------------------------------
    // DISTRIBUCIÓN DE TIPOS DE ENDOSO
    // --------------------------------------------------

    const distribucionTipos =
        new Map<string, number>();


    for (const resultado of resultados) {

        for (
            const movimiento of
            resultado.movimientosCertificado0
        ) {

            const tipo =
                movimiento.tipoEndoso ?? "NULL";


            const cantidadActual =
                distribucionTipos.get(tipo) ?? 0;


            distribucionTipos.set(
                tipo,
                cantidadActual + 1
            );
        }
    }


    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "TIPOS DE ENDOSO EN PÓLIZAS SIN F"
    );

    console.log(
        "=================================================="
    );


    console.table(
        Array.from(
            distribucionTipos.entries()
        )
            .sort(
                (
                    a: [string, number],
                    b: [string, number]
                ) =>
                    b[1] - a[1]
            )
            .map(
                (
                    entrada: [string, number]
                ) => ({
                    tipo:
                        entrada[0],

                    cantidad:
                        entrada[1]
                })
            )
    );


    // --------------------------------------------------
    // CANDIDATOS R / E
    // --------------------------------------------------

    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "CANDIDATOS R / E"
    );

    console.log(
        "=================================================="
    );


    console.table(
        resultados.map(
            (resultado: AnalisisPolizaSinF) => ({
                ramo:
                    resultado.codigoRamo,

                poliza:
                    resultado.numeroPoliza,

                facturacion:
                    obtenerIdentificadorFacturacion(
                        resultado
                    ),

                fuente:
                    resultado.fuenteCandidato,

                endoso:
                    resultado.candidato?.endoso ?? null,

                tipo:
                    resultado.candidato?.tipoEndoso ?? null,

                motivo:
                    resultado.candidato?.motivoEndoso ?? null,

                desde:
                    resultado.candidato?.vigenciaDesde ?? null,

                hasta:
                    resultado.candidato?.vigenciaHasta ?? null,

                dias:
                    resultado.candidato?.duracionDias ?? null,

                primaPeriodica:
                    resultado.primaPeriodicaCandidata,

                primaAnual:
                    resultado.primaAnualProyectada,

                primaInformada:
                    resultado.primaInformada,

                premioInformado:
                    resultado.premioInformado
            })
        )
    );


    // --------------------------------------------------
    // CASOS SIN R NI E
    // --------------------------------------------------

    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "PÓLIZAS SIN R NI E POSITIVO"
    );

    console.log(
        "=================================================="
    );


    console.table(
        sinCandidato.map(
            (resultado: AnalisisPolizaSinF) => ({
                ramo:
                    resultado.codigoRamo,

                poliza:
                    resultado.numeroPoliza,

                facturacion:
                    obtenerIdentificadorFacturacion(
                        resultado
                    ),

                movimientosCertificado0:
                    resultado.movimientosCertificado0.length,

                tipos:
                    resultado.movimientosCertificado0
                        .map(
                            (movimiento: EndosoDiagnostico) =>
                                `${movimiento.tipoEndoso ?? "-"}`
                                + "/"
                                + `${movimiento.motivoEndoso ?? "-"}`
                        )
                        .join(", ")
            })
        )
    );


    // --------------------------------------------------
    // PROYECCIONES QUE SUPERAN EL UMBRAL
    // --------------------------------------------------

    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "PROYECCIONES >= $5.000.000"
    );

    console.log(
        "=================================================="
    );


    console.table(
        primaAlta.map(
            (resultado: AnalisisPolizaSinF) => ({
                ramo:
                    resultado.codigoRamo,

                poliza:
                    resultado.numeroPoliza,

                facturacion:
                    obtenerIdentificadorFacturacion(
                        resultado
                    ),

                fuente:
                    resultado.fuenteCandidato,

                tipo:
                    resultado.candidato?.tipoEndoso ?? null,

                motivo:
                    resultado.candidato?.motivoEndoso ?? null,

                primaPeriodica:
                    resultado.primaPeriodicaCandidata,

                factor:
                    resultado.cantidadFacturacion,

                primaAnual:
                    resultado.primaAnualProyectada,

                primaInformada:
                    resultado.primaInformada,

                premioInformado:
                    resultado.premioInformado
            })
        )
    );


    // --------------------------------------------------
    // GUARDAR RESULTADO
    // --------------------------------------------------

    const archivoSalida =
        path.resolve(
            __dirname,
            "fedpat-sin-f-diagnostico.json"
        );


    const salida = {

        generadoEn:
            new Date().toISOString(),

        objetivo:
            "Evaluar R y E como fallback de prima periódica en pólizas D/2 y T/2 sin refacturación F positiva.",

        advertencia:
            "Diagnóstico exploratorio. La selección R -> E y la multiplicación por 2 todavía no constituyen una regla productiva.",

        resumen,

        resultados
    };


    fs.writeFileSync(
        archivoSalida,
        JSON.stringify(
            salida,
            null,
            2
        ),
        "utf8"
    );


    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "ARCHIVO GENERADO"
    );

    console.log(
        "=================================================="
    );


    console.log(
        archivoSalida
    );


    console.log();

    console.log(
        "✓ Diagnóstico sin F finalizado correctamente."
    );
}


/**
 * Punto de entrada del script.
 */
try {

    main();

} catch (error: unknown) {

    console.error(
        "\n❌ Error ejecutando diagnóstico:"
    );


    if (error instanceof Error) {

        console.error(
            error.message
        );

        console.error(
            error.stack
        );

    } else {

        console.error(error);
    }


    process.exit(1);
}