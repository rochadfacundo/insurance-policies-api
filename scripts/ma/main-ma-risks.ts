
import dotenv from "dotenv";
import path from "path";

// ======================================================
// 1. CONFIGURACIÓN DE ENTORNO
// ======================================================

dotenv.config({
    path: path.resolve(__dirname, "../.env.scripts.backup")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

// ======================================================
// 2. IMPORTACIONES
// ======================================================

import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";
import { MercantilSyncService } from "../../src/companias/mercantil/services/mercantilSyncService";

import { FirestorePolizaRepository } from "../../src/repositories/firestorePolizaRepository";
import { FirestoreErrorRepository } from "../../src/repositories/firebaseErrorRepository";

import { ECompania } from "../../src/models/eCompania";
import { ErrorSincronizacion } from "../../src/models/errorSincronizacion";
import { ErrorProductor } from "../../src/models/errorProductor";
import { ResumenGeneral } from "../../src/models/sync";

import { formatearDuracion } from "../../src/utils/utils";

import {
    mostrarResumen,
    normalizarError,
    obtenerMensajeError
} from "../../src/utils/syncUtils";

// ======================================================
// 3. PROCESO PRINCIPAL
// ======================================================

async function main(): Promise<void> {

    const inicioGeneral = Date.now();

    // --------------------------------------------------
    // 3.1. Inicialización de servicios y repositorios
    // --------------------------------------------------

    const syncService = new MercantilSyncService();
    const polizaRepository = new FirestorePolizaRepository();
    const errorRepository = new FirestoreErrorRepository();

    // --------------------------------------------------
    // 3.2. Productores activos
    // --------------------------------------------------

    const productores = obtenerProductoresMercantil()
        .filter(productor => productor.estado_id === 1);

    // --------------------------------------------------
    // 3.3. Contadores y errores
    // --------------------------------------------------

    const erroresProductores: ErrorProductor[] = [];

    let productoresProcesados = 0;
    let productoresExitosos = 0;
    let productoresConError = 0;

    let totalRiesgosActuales = 0;
    let totalRiesgosNuevos = 0;
    let totalRiesgosActualizados = 0;
    let totalRiesgosEliminados = 0;

    // --------------------------------------------------
    // 3.4. Encabezado
    // --------------------------------------------------

    console.log("");
    console.log("==================================================");
    console.log("SINCRONIZACIÓN GENERAL - MERCANTIL ANDINA");
    console.log("==================================================");
    console.log(`Productores a procesar: ${productores.length}`);
    console.log("");

    // ==================================================
    // 4. SINCRONIZACIÓN POR PRODUCTOR
    // ==================================================

    for (const [indice, productor] of productores.entries()) {

        const inicioProductor = Date.now();

        console.log("");
        console.log("--------------------------------------------------");
        console.log(
            `[${indice + 1}/${productores.length}] ` +
            `${productor.codigo} - ${productor.nombre}`
        );
        console.log("--------------------------------------------------");

        try {

            // ------------------------------------------
            // 4.1. Consultar Mercantil y detectar riesgos
            // ------------------------------------------

            console.log("Obteniendo cartera y recalculando riesgos...");

            const riesgosActuales = await syncService.sincronizar(
                productor
            );

            console.log(
                `Riesgos actuales válidos: ${riesgosActuales.length}`
            );

            // ------------------------------------------
            // 4.2. Sincronizar riesgos en Firestore
            // ------------------------------------------

            /*
             * Compara los riesgos obtenidos de Mercantil
             * con los almacenados en Firestore.
             *
             * - Inserta nuevos riesgos.
             * - Actualiza los existentes.
             * - Archiva los que desaparecieron.
             * - Elimina de "polizas" los desaparecidos.
             */

            const resultado =
                await polizaRepository.sincronizarRiesgosProductor(
                    productor,
                    ECompania.MERCANTIL_ANDINA,
                    riesgosActuales
                );

            // ------------------------------------------
            // 4.3. Acumular resultados
            // ------------------------------------------

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

            // ------------------------------------------
            // 4.4. Registrar error del productor
            // ------------------------------------------

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

            // ------------------------------------------
            // 4.5. Guardar error en Firestore
            // ------------------------------------------

            try {

                const errorFirestore: ErrorSincronizacion = {
                    compania: ECompania.MERCANTIL_ANDINA,

                    productor: {
                        codigo: productor.codigo,
                        matricula: productor.matricula,
                        nombre: productor.nombre
                    },

                    servicio: "sincronizacion-general-riesgos",

                    mensaje: errorNormalizado.mensaje
                };

                if (errorNormalizado.detalle !== undefined) {
                    errorFirestore.detalle = errorNormalizado.detalle;
                }

                await errorRepository.guardar(errorFirestore);

                console.log("Error guardado en Firestore.");

            } catch (errorGuardandoFirestore: unknown) {

                console.error(
                    "No se pudo guardar el error en Firestore:"
                );

                console.error(
                    obtenerMensajeError(errorGuardandoFirestore)
                );
            }

        } finally {

            // ------------------------------------------
            // 4.6. Estadísticas del productor
            // ------------------------------------------

            productoresProcesados++;

            console.log(
                `Tiempo productor: ${formatearDuracion(
                    Date.now() - inicioProductor
                )}`
            );
        }
    }

    // ==================================================
    // 5. RESUMEN GENERAL
    // ==================================================

    const resumen: ResumenGeneral = {
        productoresTotales: productores.length,
        productoresProcesados,
        productoresExitosos,
        productoresConError,

        riesgosActuales: totalRiesgosActuales,
        riesgosNuevos: totalRiesgosNuevos,
        riesgosActualizados: totalRiesgosActualizados,
        riesgosEliminados: totalRiesgosEliminados,

        duracionTotal: formatearDuracion(
            Date.now() - inicioGeneral
        )
    };

    mostrarResumen(resumen, erroresProductores);

    if (productoresConError > 0) {
        process.exitCode = 1;
    }
}

// ======================================================
// 6. EJECUCIÓN Y CONTROL DE ERRORES FATALES
// ======================================================

main()
    .then(() => {

        console.log("");
        console.log("Proceso general finalizado.");

    })
    .catch((error: unknown) => {

        console.error("");
        console.error(
            "El proceso general finalizó con un error fatal."
        );

        console.error(obtenerMensajeError(error));

        process.exitCode = 1;
    });
