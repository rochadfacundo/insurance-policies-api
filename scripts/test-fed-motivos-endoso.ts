import * as dotenv from "dotenv";
import * as path from "path";

import { FedPatAuthService }
    from "../src/companias/fed-pat/services/fedPatAuthService";

import { FedPatMotivosEndosoService }
    from "../src/companias/fed-pat/services/fedPatMotivosEndosoService";

import { FedPatMotivoEndoso }
    from "../src/companias/fed-pat/models/fedPatMotivoEndoso";


/**
 * Carga las variables de entorno necesarias para autenticar
 * las consultas contra la API de Federación Patronal.
 */
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});


/**
 * Códigos de motivo observados durante el análisis histórico
 * de las pólizas T/2.
 *
 * Importante:
 * `codigo` por sí solo no necesariamente identifica un motivo.
 * Según el modelo de FedPat, la identidad se determina mediante
 * la combinación `tpMotivos + codigo`.
 */
const CODIGOS_ANALIZADOS = new Set<number>([
    1,
    2,
    11,
    26,
    102
]);


/**
 * Ejecuta un diagnóstico del catálogo oficial de motivos de endoso.
 *
 * Objetivo:
 * identificar qué significado tienen los códigos encontrados en
 * los movimientos R, F, N, A y E de las pólizas T/2 analizadas.
 *
 * Este script:
 * - solamente consulta el catálogo de FedPat;
 * - no modifica Firestore;
 * - no aplica reglas de anualización;
 * - conserva `tpMotivos` porque forma parte de la identidad
 *   semántica del motivo.
 */
async function main(): Promise<void> {

    console.log(
        "=================================================="
    );

    console.log(
        "FEDPAT - MOTIVOS DE ENDOSO"
    );

    console.log(
        "=================================================="
    );


    // --------------------------------------------------
    // SERVICES
    // --------------------------------------------------

    const authService =
        new FedPatAuthService();

    const motivosService =
        new FedPatMotivosEndosoService(
            authService
        );


    // --------------------------------------------------
    // CONSULTAR CATÁLOGO
    // --------------------------------------------------

    console.log(
        "\nConsultando catálogo de motivos..."
    );

    const motivos: FedPatMotivoEndoso[] =
        await motivosService
            .obtenerMotivosEndoso();


    console.log(
        `Motivos recibidos: ${motivos.length}`
    );


    // --------------------------------------------------
    // DISTRIBUCIÓN DE tpMotivos
    // --------------------------------------------------

    /**
     * Antes de interpretar los códigos mostramos qué valores
     * diferentes de `tpMotivos` existen en el catálogo.
     *
     * Esto nos permite entender cómo organiza FedPat los motivos.
     */
    const tiposMotivo =
        Array.from(
            new Set(
                motivos.map(
                    (motivo: FedPatMotivoEndoso) =>
                        motivo.tpMotivos
                )
            )
        )
            .sort();


    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "TIPOS DE MOTIVO DISPONIBLES"
    );

    console.log(
        "=================================================="
    );

    console.table(
        tiposMotivo.map(
            (tipo: string) => ({
                tpMotivos: tipo,

                cantidad:
                    motivos.filter(
                        (motivo: FedPatMotivoEndoso) =>
                            motivo.tpMotivos === tipo
                    ).length
            })
        )
    );


    // --------------------------------------------------
    // CÓDIGOS ENCONTRADOS EN T/2
    // --------------------------------------------------

    /**
     * Filtramos todos los registros cuyo código apareció en nuestro
     * diagnóstico T/2.
     *
     * No usamos find() porque un mismo código puede potencialmente
     * existir bajo más de un `tpMotivos`.
     */
    const motivosAnalizados: FedPatMotivoEndoso[] =
        motivos
            .filter(
                (motivo: FedPatMotivoEndoso) =>
                    CODIGOS_ANALIZADOS.has(
                        motivo.codigo
                    )
            )
            .sort(
                (
                    a: FedPatMotivoEndoso,
                    b: FedPatMotivoEndoso
                ) => {

                    const comparacionTipo =
                        a.tpMotivos.localeCompare(
                            b.tpMotivos
                        );

                    if (comparacionTipo !== 0) {
                        return comparacionTipo;
                    }

                    return (
                        a.codigo -
                        b.codigo
                    );
                }
            );


    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "MOTIVOS RELACIONADOS CON T / 2"
    );

    console.log(
        "=================================================="
    );


    console.table(
        motivosAnalizados.map(
            (motivo: FedPatMotivoEndoso) => ({
                tpMotivos:
                    motivo.tpMotivos,

                codigo:
                    motivo.codigo,

                descripcion:
                    motivo.descripcion
            })
        )
    );


    // --------------------------------------------------
    // DETALLE POR CÓDIGO
    // --------------------------------------------------

    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "DETALLE POR CÓDIGO"
    );

    console.log(
        "=================================================="
    );


    const codigosOrdenados: number[] =
        Array.from(
            CODIGOS_ANALIZADOS
        )
            .sort(
                (a: number, b: number) =>
                    a - b
            );


    for (
        const codigo of
        codigosOrdenados
    ) {

        const coincidencias: FedPatMotivoEndoso[] =
            motivosAnalizados.filter(
                (motivo: FedPatMotivoEndoso) =>
                    motivo.codigo === codigo
            );


        console.log(
            `\nCódigo ${codigo}:`
        );


        if (
            coincidencias.length === 0
        ) {

            console.log(
                "  No encontrado en el catálogo."
            );

            continue;
        }


        for (
            const motivo of
            coincidencias
        ) {

            console.log(
                `  [${motivo.tpMotivos}] ${motivo.descripcion}`
            );
        }
    }


    // --------------------------------------------------
    // CATÁLOGO COMPLETO
    // --------------------------------------------------

    /**
     * Mostramos también el catálogo completo.
     *
     * Esto puede revelar otros códigos o descripciones relacionadas
     * con altas, bajas, modificaciones, refacturaciones o renovaciones
     * que ayuden a interpretar los tipos R/F/N/A/E.
     */
    console.log();

    console.log(
        "=================================================="
    );

    console.log(
        "CATÁLOGO COMPLETO"
    );

    console.log(
        "=================================================="
    );


    console.table(
        motivos
            .slice()
            .sort(
                (
                    a: FedPatMotivoEndoso,
                    b: FedPatMotivoEndoso
                ) => {

                    const comparacionTipo =
                        a.tpMotivos.localeCompare(
                            b.tpMotivos
                        );

                    if (comparacionTipo !== 0) {
                        return comparacionTipo;
                    }

                    return (
                        a.codigo -
                        b.codigo
                    );
                }
            )
            .map(
                (motivo: FedPatMotivoEndoso) => ({
                    tpMotivos:
                        motivo.tpMotivos,

                    codigo:
                        motivo.codigo,

                    descripcion:
                        motivo.descripcion
                })
            )
    );


    console.log();

    console.log(
        "✓ Diagnóstico de motivos finalizado correctamente."
    );
}


/**
 * Punto de entrada del script.
 */
main()
    .catch(
        (error: unknown) => {

            console.error(
                "\n❌ Error ejecutando diagnóstico:"
            );

            if (
                error instanceof Error
            ) {

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
    );