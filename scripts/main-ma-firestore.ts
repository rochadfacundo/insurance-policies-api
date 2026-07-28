import axios from "axios";

import { ECompania } from "../src/models/eCompania";
import { ErrorSincronizacion } from "../src/models/errorSincronizacion";

import { obtenerProductoresMercantil } from "../src/companias/mercantil/models/productoresMercantil";
import { MercantilSyncService } from "../src/companias/mercantil/services/mercantilSyncService";

import { FirestorePolizaRepository } from "../src/repositories/firestorePolizaRepository";
import { FirestoreErrorRepository } from "../src/repositories/firebaseErrorRepository";

interface ProductorConError {
    codigo: number;
    nombre: string;
    mensaje: string;
    status?: number;
}

interface ErrorNormalizado {
    mensaje: string;
    status?: number;
    detalle?: unknown;
}

interface ResumenSincronizacion {
    productoresTotales: number;
    productoresProcesados: number;
    productoresExitosos: number;
    productoresSinRiesgos: number;
    productoresConError: number;

    totalRiesgosActuales: number;
    totalRiesgosNuevos: number;
    totalRiesgosActualizados: number;
    totalRiesgosEliminados: number;

    duracionTotal: string;
}

async function main(): Promise<void> {

    const inicioProceso = Date.now();

    //const productores = obtenerProductoresMercantil().filter(productor => productor.estado_id === 1);

    const productores = obtenerProductoresMercantil().filter(productor => productor.estado_id === 1 && productor.codigo === 83973);

    const syncService = new MercantilSyncService();

    const polizaRepository = new FirestorePolizaRepository();

    const errorRepository = new FirestoreErrorRepository();

    const erroresProductores: ProductorConError[] = [];

    let productoresProcesados = 0;
    let productoresExitosos = 0;
    let productoresSinRiesgos = 0;
    let productoresConError = 0;

    let totalRiesgosActuales = 0;
    let totalRiesgosNuevos = 0;
    let totalRiesgosActualizados = 0;
    let totalRiesgosEliminados = 0;

    console.log("==================================================");
    console.log("SINCRONIZACIÓN DE RIESGOS - MERCANTIL ANDINA");
    console.log("==================================================");
    console.log(`Productores a procesar: ${productores.length}`);

    for (
        let indice = 0;
        indice < productores.length;
        indice++
    ) {

        const productor = productores[indice];

        if (!productor) {
            continue;
        }

        const inicioProductor = Date.now();

        console.log("");
        console.log("--------------------------------------------------");
        console.log(
            `[${indice + 1}/${productores.length}] ` +
            `${productor.codigo} - ${productor.nombre}`
        );
        console.log("--------------------------------------------------");

        productoresProcesados++;

        try {

            console.log("Obteniendo cartera y detectando riesgos...");

            const polizasRiesgosas = await syncService.sincronizar(productor);


            console.log(`Pólizas con riesgos detectados: ${polizasRiesgosas.length}`);

            const resultadoSincronizacion = await polizaRepository.sincronizarRiesgosProductor(productor,ECompania.MERCANTIL_ANDINA, polizasRiesgosas);

            productoresExitosos++;

            if (polizasRiesgosas.length === 0) {
                productoresSinRiesgos++;
            }

            totalRiesgosActuales += resultadoSincronizacion.riesgosActuales;
            totalRiesgosNuevos += resultadoSincronizacion.riesgosNuevos;
            totalRiesgosActualizados += resultadoSincronizacion.riesgosActualizados;
            totalRiesgosEliminados += resultadoSincronizacion.riesgosEliminados;

            console.log("Resultado de la reconciliación:");
            console.log(`- Riesgos actuales: ${resultadoSincronizacion.riesgosActuales}`);
            console.log(`- Riesgos nuevos: ${resultadoSincronizacion.riesgosNuevos}`);
            console.log(`- Riesgos actualizados: ${resultadoSincronizacion.riesgosActualizados}`);
            console.log(`- Riesgos eliminados: ${resultadoSincronizacion.riesgosEliminados}`);

            if (polizasRiesgosas.length === 0) {
                console.log("El productor no posee riesgos actuales. " +"Se reconciliaron los riesgos almacenados.");
            }

        } catch (error) {

            productoresConError++;

            const errorNormalizado = normalizarError(error);

            const productorConError: ProductorConError = {
                codigo: productor.codigo,
                nombre: productor.nombre,
                mensaje: errorNormalizado.mensaje
            };

            if (errorNormalizado.status !== undefined) {
                productorConError.status =
                    errorNormalizado.status;
            }

            erroresProductores.push(productorConError);

            console.error(`Error procesando al productor ` + `${productor.codigo}:`);

            console.error(errorNormalizado.mensaje);

            try {

                const errorParaGuardar: ErrorSincronizacion = {
                    compania:     ECompania.MERCANTIL_ANDINA,
                    productor,
                    servicio: "cartera",
                    mensaje: errorNormalizado.mensaje
                };

                if (
                    errorNormalizado.detalle !== undefined
                ) {
                    errorParaGuardar.detalle =     errorNormalizado.detalle;
                }

                const idError =
                    await errorRepository.guardar(
                        errorParaGuardar
                    );

                console.log(
                    `Error general guardado en Firestore ` +
                    `con ID: ${idError}`
                );

            } catch (errorFirestore) {

                console.error(
                    "No se pudo guardar el error general " +
                    "en Firestore:"
                );

                console.error(errorFirestore);
            }
        }

        const duracionProductor =formatearDuracion(Date.now() - inicioProductor);

        console.log(`Tiempo productor: ${duracionProductor}`);
    }

    const resumen: ResumenSincronizacion = {
        productoresTotales: productores.length,
            productoresProcesados,
            productoresExitosos,
            productoresSinRiesgos,
            productoresConError,
            totalRiesgosActuales,
            totalRiesgosNuevos,
            totalRiesgosActualizados,
            totalRiesgosEliminados,
            duracionTotal: formatearDuracion(Date.now() - inicioProceso)
        };

    console.log("");
    console.log("==================================================");
    console.log("RESUMEN GENERAL");
    console.log("==================================================");
    console.log(resumen);

    console.log("");
    console.log("==================================================");
    console.log("PRODUCTORES CON ERROR");
    console.log("==================================================");

    if (erroresProductores.length === 0) {

        console.log("No hubo errores generales de productor.");

    } else {

        console.table(erroresProductores);
    }
}

function normalizarError(error: unknown): ErrorNormalizado {

    if (axios.isAxiosError(error)) {

        const resultado: ErrorNormalizado = {
            mensaje: obtenerMensajeAxios(error) ?? error.message ?? "Error HTTP desconocido"};

        if (error.response?.status !== undefined) {
            resultado.status = error.response.status;
        }

        if (error.response?.data !== undefined) {
            resultado.detalle = error.response.data;
        }

        return resultado;
    }

    if (error instanceof Error) {

        return { mensaje: error.message };
    }

    return {
        mensaje: "Error desconocido",
        detalle: error
    };
}

function obtenerMensajeAxios(error: unknown): string | undefined {

    if (!axios.isAxiosError(error)) {
        return undefined;
    }

    const data = error.response?.data;

    if (data !== null &&  typeof data === "object") {

        if ("message" in data && typeof data.message === "string" && data.message.trim().length > 0) {
            return data.message;
        }

        if ("mensaje" in data && typeof data.mensaje === "string" && data.mensaje.trim().length > 0) {
            return data.mensaje;
        }

        if ("errores" in data && Array.isArray(data.errores)) {

            const textos = data.errores.map((item: { texto: any; } | null) => {

                    if ( item !== null && typeof item === "object" && "texto" in item && typeof item.texto === "string") {
                        return item.texto;
                    }

                    return undefined;
                }).filter((texto: string | undefined): texto is string => texto !== undefined);

            if (textos.length > 0) {
                return textos.join(" | ");
            }
        }
    }

    return error.message;
}

function formatearDuracion(milisegundos: number): string {

    const segundosTotales = Math.floor(milisegundos / 1000);

    const horas = Math.floor(segundosTotales / 3600);

    const minutos = Math.floor((segundosTotales % 3600) / 60);

    const segundos = segundosTotales % 60;

    if (horas > 0) {
        return (`${horas}h ` + `${minutos}m ` +`${segundos}s`);
    }

    return (`${minutos}m ` + `${segundos}s`);
}

main()
    .then(() => {
        console.log("");
        console.log("Sincronización finalizada correctamente.");

    })
    .catch(error => {

        console.error("");
        console.error("La sincronización finalizó con un error fatal:");

        console.error(error);

        process.exitCode = 1;
    });