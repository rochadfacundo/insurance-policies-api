import { obtenerProductoresMercantil } from "../src/companias/mercantil/models/productoresMercantil";

import { FirestoreErrorRepository } from "../src/repositories/firebaseErrorRepository";
import { FirestoreStatsCarteraRepository } from "../src/repositories/firestoreStatsCarteraRepository";

import { ECompania } from "../src/models/eCompania";
import { ErrorSincronizacion } from "../src/models/errorSincronizacion";
import { ErrorProductor } from "../src/models/errorProductor";
import { Productor } from "../src/models/productor";
import { StatsCartera } from "../src/models/statsCartera";

import { formatearDuracion } from "../src/utils/utils";
import {normalizarError,obtenerMensajeError} from "../src/utils/syncUtils";

import { MercantilCarteraStatsService} from "../src/companias/mercantil/services/mercantilStatsService";


async function main(): Promise<void> {

    const inicioGeneral = Date.now();

    const statsService = new MercantilCarteraStatsService();

    const statsRepository = new FirestoreStatsCarteraRepository();

    const errorRepository = new FirestoreErrorRepository();


    /*
     * PRUEBA:
     *
     * Javier Fessel tiene dos códigos Mercantil
     * asociados a la misma matrícula.
     *
     * Esto nos permite validar que ambos códigos
     * se consoliden en una única estadística.
     */
    const productores = obtenerProductoresMercantil().filter(productor => productor.estado_id === 1);
    

    console.log(productores);
    /*
     * PRODUCCIÓN:
     *
     * const productores =
     *     obtenerProductoresMercantil()
     *         .filter(
     *             productor =>
     *                 productor.estado_id === 1
     *         );
     */


    /*
     * Agrupamos productores.
     *
     * Si tiene matrícula:
     *
     * MATRÍCULA_83538
     *
     * Si no tiene matrícula:
     *
     * SIN_MATRICULA_92340
     *
     * De esta forma los productores sin matrícula
     * no se agrupan accidentalmente entre sí.
     */
    const gruposProductores =
        new Map<string, Productor[]>();


    for (const productor of productores) {

        const clave =
            productor.matricula !== null
                ? `MATRICULA_${productor.matricula}`
                : `SIN_MATRICULA_${productor.codigo}`;


        const grupoActual =
            gruposProductores.get(clave) ?? [];


        grupoActual.push(
            productor
        );


        gruposProductores.set(
            clave,
            grupoActual
        );
    }


    const grupos =
        Array.from(
            gruposProductores.values()
        );


    const estadisticas: StatsCartera[] = [];

    const erroresProductores: ErrorProductor[] = [];


    let gruposProcesados = 0;

    let gruposExitosos = 0;

    let gruposConError = 0;

    let totalPolizasVigentes = 0;


    console.log("");
    console.log("==================================================");
    console.log("ESTADÍSTICAS DE CARTERA - MERCANTIL ANDINA");
    console.log("==================================================");

    console.log(
        `Códigos productores: ${productores.length}`
    );

    console.log(
        `Productores consolidados: ${grupos.length}`
    );

    console.log("");


    for (
        let indice = 0;
        indice < grupos.length;
        indice++
    ) {

        const grupo =
            grupos[indice];


        if (!grupo || grupo.length === 0) {
            continue;
        }


        const productorPrincipal =
            grupo[0];


        if (!productorPrincipal) {
            continue;
        }


        const inicioProductor =
            Date.now();


        console.log("");
        console.log("--------------------------------------------------");

        console.log(
            `[${indice + 1}/${grupos.length}] ` +
            `${productorPrincipal.nombre} ` +
            `| Matrícula: ` +
            `${productorPrincipal.matricula ?? "SIN MATRÍCULA"}`
        );

        console.log(
            `Códigos Mercantil: ` +
            `${grupo
                .map(
                    productor =>
                        productor.codigo
                )
                .join(", ")}`
        );

        console.log("--------------------------------------------------");


        try {

            console.log(
                "Obteniendo cartera vigente..."
            );


            /*
             * Consulta la cartera de todos los códigos
             * Mercantil asociados al mismo productor.
             *
             * El service consolida las pólizas
             * eliminando duplicados por número de póliza.
             */
            const estadistica =
                await statsService.obtener(
                    grupo
                );


            console.log(
                `Pólizas vigentes únicas: ` +
                `${estadistica.cantidadPolizas}`
            );


            /*
             * Guarda o actualiza la estadística
             * consolidada en Firestore.
             */
            console.log(
                "Guardando estadística en Firestore..."
            );


            await statsRepository.guardar(
                estadistica
            );


            console.log(
                "Estadística guardada en Firestore."
            );


            estadisticas.push(
                estadistica
            );


            gruposExitosos++;


            totalPolizasVigentes +=
                estadistica.cantidadPolizas;

        } catch (error: unknown) {

            gruposConError++;


            const errorNormalizado =
                normalizarError(
                    error
                );


            const errorProductor:
                ErrorProductor = {

                codigo:
                    productorPrincipal.codigo,

                nombre:
                    productorPrincipal.nombre,

                mensaje:
                    errorNormalizado.mensaje
            };


            if (
                errorNormalizado.status !==
                undefined
            ) {

                errorProductor.status =
                    errorNormalizado.status;
            }


            if (
                errorNormalizado.detalle !==
                undefined
            ) {

                errorProductor.detalle =
                    errorNormalizado.detalle;
            }


            erroresProductores.push(
                errorProductor
            );


            console.error("");

            console.error(
                `Error procesando productor ` +
                `${productorPrincipal.nombre}`
            );

            console.error(
                errorNormalizado.mensaje
            );


            try {

                const errorFirestore:
                    ErrorSincronizacion = {

                    compania:
                        ECompania.MERCANTIL_ANDINA,

                    productor: {
                        codigo:
                            productorPrincipal.codigo,

                        nombre:
                            productorPrincipal.nombre,

                        matricula:
                            productorPrincipal.matricula
                    },

                    servicio:
                        "estadisticas-cartera",

                    mensaje:
                        errorNormalizado.mensaje
                };


                if (
                    errorNormalizado.detalle !==
                    undefined
                ) {

                    errorFirestore.detalle =
                        errorNormalizado.detalle;
                }


                await errorRepository.guardar(
                    errorFirestore
                );


                console.log(
                    "Error guardado en Firestore."
                );

            } catch (
                errorGuardandoFirestore: unknown
            ) {

                console.error(
                    "No se pudo guardar el error " +
                    "en Firestore:"
                );

                console.error(
                    obtenerMensajeError(
                        errorGuardandoFirestore
                    )
                );
            }

        } finally {

            gruposProcesados++;


            console.log(
                `Tiempo productor: ` +
                `${formatearDuracion(
                    Date.now() -
                    inicioProductor
                )}`
            );
        }
    }


    /*
     * Ordenamos por cantidad de pólizas
     * para facilitar la lectura.
     */
    estadisticas.sort(
        (a, b) =>
            b.cantidadPolizas -
            a.cantidadPolizas
    );


    console.log("");
    console.log("");
    console.log("==================================================");
    console.log("DETALLE POR PRODUCTOR");
    console.log("==================================================");


    for (const estadistica of estadisticas) {

        console.log(
            `${estadistica.nombreProductor} ` +
            `| Matrícula: ` +
            `${estadistica.matricula ?? "SIN MATRÍCULA"} ` +
            `| Códigos: ` +
            `${estadistica.codigosProductor.join(", ")} ` +
            `| Pólizas: ` +
            `${estadistica.cantidadPolizas}`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("RESUMEN GENERAL");
    console.log("==================================================");


    console.log({

        codigosProductores:
            productores.length,

        productoresConsolidados:
            grupos.length,

        gruposProcesados,

        gruposExitosos,

        gruposConError,

        totalPolizasVigentes,

        duracionTotal:
            formatearDuracion(
                Date.now() -
                inicioGeneral
            )
    });


    if (
        erroresProductores.length > 0
    ) {

        console.log("");
        console.log("==================================================");
        console.log("PRODUCTORES CON ERROR");
        console.log("==================================================");

        console.log(
            erroresProductores
        );
    }


    if (
        gruposConError > 0
    ) {

        process.exitCode = 1;
    }
}


main()
    .then(() => {

        console.log("");

        console.log(
            "Proceso de estadísticas finalizado."
        );

    })
    .catch(
        (
            error: unknown
        ) => {

            console.error("");

            console.error(
                "El proceso finalizó con un error fatal."
            );

            console.error(
                obtenerMensajeError(
                    error
                )
            );

            process.exitCode = 1;
        }
    );