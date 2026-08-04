import axios from "axios";

import {
    obtenerProductoresMercantil
} from "../src/companias/mercantil/models/productoresMercantil";

import {
    MercantilSyncService
} from "../src/companias/mercantil/services/mercantilSyncService";

import {
    FirestorePolizaRepository
} from "../src/repositories/firestorePolizaRepository";

import {
    FirestoreErrorRepository
} from "../src/repositories/firebaseErrorRepository";

import {
    ECompania
} from "../src/models/eCompania";

import {
    ErrorSincronizacion
} from "../src/models/errorSincronizacion";


interface ErrorProductor {
    codigo: number;
    nombre: string;
    status?: number;
    mensaje: string;
    detalle?: unknown;
}


interface ResumenGeneral {
    productoresTotales: number;
    productoresProcesados: number;
    productoresExitosos: number;
    productoresConError: number;

    riesgosActuales: number;
    riesgosNuevos: number;
    riesgosActualizados: number;
    riesgosEliminados: number;

    duracionTotal: string;
}


interface ErrorNormalizado {
    mensaje: string;
    status?: number;
    detalle?: unknown;
}


async function main(): Promise<void> {

    const inicioGeneral = Date.now();

    const syncService = new MercantilSyncService();

    const polizaRepository = new FirestorePolizaRepository();

    const errorRepository = new FirestoreErrorRepository();

    /*
     * Procesamos solamente productores activos.
     *
     * Si estado_id no existe en tu modelo o los activos usan otro valor,
     * eliminá esa condición.
     */
    const productores = obtenerProductoresMercantil().filter(productor => productor.estado_id === 1);



    const erroresProductores: ErrorProductor[] = [];

    let productoresProcesados = 0;
    let productoresExitosos = 0;
    let productoresConError = 0;

    let totalRiesgosActuales = 0;
    let totalRiesgosNuevos = 0;
    let totalRiesgosActualizados = 0;
    let totalRiesgosEliminados = 0;

    console.log("");
    console.log("==================================================");
    console.log("SINCRONIZACIÓN GENERAL - MERCANTIL ANDINA");
    console.log("==================================================");
    console.log(`Productores a procesar: ${productores.length}`);
    console.log("");
    console.log("La sincronización recalculará los riesgos de cada productor, ");
    console.log("");

    for (let indice = 0; indice < productores.length; indice++) {

        const productor = productores[indice];

        const inicioProductor = Date.now();

        
        if(productor==null || productor==undefined){
            return;
        }

        console.log("");
        console.log("--------------------------------------------------");
        console.log(
            `[${indice + 1}/${productores.length}] ` +
            `${productor.codigo} - ${productor.nombre}`
        );
        console.log("--------------------------------------------------");

        try {

            console.log("Obteniendo cartera y recalculando riesgos...");

            /*
             * sincronizar() consulta:
             *
             * cartera
             * → detalle
             * → bienes
             * → mapper
             * → RiskEngine
             *
             * Devuelve únicamente los riesgos actuales.
             */
            const riesgosActuales = await syncService.sincronizar(productor);

            console.log(`Riesgos actuales válidos: ${riesgosActuales.length}`);

            const resultado = await polizaRepository.sincronizarRiesgosProductor(productor, ECompania.MERCANTIL_ANDINA, riesgosActuales);

            /*
             * Compara:
             *
             * riesgos actuales obtenidos de Mercantil
             * vs.
             * riesgos guardados en Firestore
             *
             * - inserta nuevos;
             * - actualiza existentes;
             * - archiva los desaparecidos;
             * - elimina los desaparecidos de "polizas".
             */
            //const resultado = await polizaRepository.sincronizarRiesgosProductor(productor,ECompania.MERCANTIL_ANDINA,riesgosActuales);

            productoresExitosos++;

            totalRiesgosActuales += resultado.riesgosActuales;
            totalRiesgosNuevos += resultado.riesgosNuevos;
            totalRiesgosActualizados += resultado.riesgosActualizados;
            totalRiesgosEliminados += resultado.riesgosEliminados;

            console.log("");
            console.log("Resultado del productor:");
            console.log(`  Riesgos actuales: ${resultado.riesgosActuales}`);
            console.log(`  Riesgos nuevos: ${resultado.riesgosNuevos}`);
            console.log(`  Riesgos actualizados: ${resultado.riesgosActualizados}`);
            console.log(`  Riesgos eliminados: ${resultado.riesgosEliminados}`);

        } catch (error: unknown) {

            productoresConError++;

            const errorNormalizado = normalizarError(error);

            const errorProductor: ErrorProductor = {
                codigo: productor.codigo,
                nombre: productor.nombre,
                mensaje: errorNormalizado.mensaje
            };

            if (errorNormalizado.status !== undefined) {
                errorProductor.status = errorNormalizado.status;
            }

            if (errorNormalizado.detalle !== undefined) {
                errorProductor.detalle = errorNormalizado.detalle;
            }

            erroresProductores.push(errorProductor);

            console.error("");
            console.error(`Error procesando productor ${productor.codigo}:`);
            console.error(errorNormalizado.mensaje);

            try {

                const errorFirestore: ErrorSincronizacion = {

                    compania: ECompania.MERCANTIL_ANDINA,

                    productor: {
                        codigo: productor.codigo,
                        nombre: productor.nombre
                    },

                    servicio: "sincronizacion-general-riesgos",

                    mensaje: errorNormalizado.mensaje,

                };

                if (errorNormalizado.detalle !== undefined) {
                    errorFirestore.detalle =
                        errorNormalizado.detalle;
                }

                await errorRepository.guardar(errorFirestore);

                console.log("Error guardado en Firestore.");

            } catch (errorGuardandoFirestore: unknown) {

                console.error("No se pudo guardar el error en Firestore:");

                console.error(obtenerMensajeError(errorGuardandoFirestore));
            }

        } finally {

            productoresProcesados++;

            console.log(`Tiempo productor: ${formatearDuracion(Date.now() - inicioProductor)}`);
        }
    }

    const resumen: ResumenGeneral = {
        productoresTotales: productores.length,
        productoresProcesados,
        productoresExitosos,
        productoresConError,
        riesgosActuales: totalRiesgosActuales,
        riesgosNuevos: totalRiesgosNuevos,
        riesgosActualizados: totalRiesgosActualizados,
        riesgosEliminados: totalRiesgosEliminados,
        duracionTotal: formatearDuracion(Date.now() - inicioGeneral)
    };

    mostrarResumen(resumen,erroresProductores);

    if (productoresConError > 0) {
        process.exitCode = 1;
    }
}


function mostrarResumen(
    resumen: ResumenGeneral,
    errores: ErrorProductor[]
): void {

    console.log("");
    console.log("==================================================");
    console.log("RESUMEN GENERAL");
    console.log("==================================================");

    console.log({
        productoresTotales:
            resumen.productoresTotales,

        productoresProcesados:
            resumen.productoresProcesados,

        productoresExitosos:
            resumen.productoresExitosos,

        productoresConError:
            resumen.productoresConError,

        riesgosActuales:
            resumen.riesgosActuales,

        riesgosNuevos:
            resumen.riesgosNuevos,

        riesgosActualizados:
            resumen.riesgosActualizados,

        riesgosEliminados:
            resumen.riesgosEliminados,

        duracionTotal:
            resumen.duracionTotal
    });

    if (errores.length === 0) {

        console.log("");
        console.log(
            "Sincronización completada sin errores."
        );

        return;
    }

    console.log("");
    console.log("==================================================");
    console.log("PRODUCTORES CON ERROR");
    console.log("==================================================");

    console.table(
        errores.map(
            error => ({
                codigo:
                    error.codigo,

                nombre:
                    error.nombre,

                status:
                    error.status ?? "-",

                mensaje:
                    error.mensaje
            })
        )
    );
}


function normalizarError(
    error: unknown
): ErrorNormalizado {

    if (axios.isAxiosError(error)) {

        const resultado: ErrorNormalizado = {
            mensaje:
                obtenerMensajeAxios(error)
        };

        if (
            error.response?.status !==
            undefined
        ) {
            resultado.status =
                error.response.status;
        }

        if (
            error.response?.data !==
            undefined
        ) {
            resultado.detalle =
                error.response.data;
        }

        return resultado;
    }

    if (error instanceof Error) {
        return {
            mensaje:
                error.message
        };
    }

    return {
        mensaje:
            "Error desconocido",

        detalle:
            error
    };
}


function obtenerMensajeAxios(
    error: unknown
): string {

    if (!axios.isAxiosError(error)) {
        return "Error HTTP desconocido";
    }

    const data =
        error.response?.data;

    if (
        data !== null &&
        typeof data === "object"
    ) {

        if (
            "message" in data &&
            typeof data.message === "string" &&
            data.message.trim().length > 0
        ) {
            return data.message;
        }

        if (
            "mensaje" in data &&
            typeof data.mensaje === "string" &&
            data.mensaje.trim().length > 0
        ) {
            return data.mensaje;
        }

        if (
            "errores" in data &&
            Array.isArray(data.errores)
        ) {

            const mensajes =
                data.errores
                    .map(
                        (
                            item: {
                                texto?: unknown;
                                mensaje?: unknown;
                            } | null
                        ): string | undefined => {

                            if (
                                item === null ||
                                typeof item !== "object"
                            ) {
                                return undefined;
                            }

                            if (
                                typeof item.texto ===
                                "string"
                            ) {
                                return item.texto;
                            }

                            if (
                                typeof item.mensaje ===
                                "string"
                            ) {
                                return item.mensaje;
                            }

                            return undefined;
                        }
                    )
                    .filter(
                        (
                            mensaje:
                                string |
                                undefined
                        ): mensaje is string =>
                            mensaje !== undefined
                    );

            if (mensajes.length > 0) {
                return mensajes.join(" | ");
            }
        }
    }

    return (
        error.message ||
        `Error HTTP ${
            error.response?.status ??
            "desconocido"
        }`
    );
}


function obtenerMensajeError(
    error: unknown
): string {

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}


function formatearDuracion(
    milisegundos: number
): string {

    const segundosTotales =
        Math.floor(
            milisegundos / 1000
        );

    const horas =
        Math.floor(
            segundosTotales / 3600
        );

    const minutos =
        Math.floor(
            (
                segundosTotales % 3600
            ) / 60
        );

    const segundos =
        segundosTotales % 60;

    if (horas > 0) {
        return (
            `${horas}h ` +
            `${minutos}m ` +
            `${segundos}s`
        );
    }

    return (
        `${minutos}m ` +
        `${segundos}s`
    );
}


main()
    .then(() => {

        console.log("");
        console.log(
            "Proceso general finalizado."
        );

    })
    .catch(
        (error: unknown) => {

            console.error("");
            console.error(
                "El proceso general finalizó con un error fatal."
            );

            console.error(
                obtenerMensajeError(error)
            );

            process.exitCode = 1;
        }
    );