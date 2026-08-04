import "dotenv/config";

import { Productor } from "../src/models/productor";
import { RusSyncService } from "../src/companias/rus/services/rusSyncService";
import { FirestorePolizaRepository } from "../src/repositories/firestorePolizaRepository";
import { ECompania } from "../src/models/eCompania";
import { obtenerProductoresRUS1 } from "../src/companias/rus/productoresRUS";
import { ModoSincronizacionRus } from "../src/companias/rus/models/modoSincronizacionRus";
import { formatearDuracion, formatearFecha, restarDias } from "../src/utils/utils";
import { ErrorProductor } from "../src/models/errorProductor";
import { FirestoreRusSyncStateRepository } from "../src/companias/rus/repositories/firestoreRusSyncStateRepository";
import { EstadoSincronizacionRus, RusSyncState } from "../src/companias/rus/models/rusSyncState";


/**
 * Rango de productores a procesar.
 *
 * slice(desde, hasta)
 *
 * Lote 1 -> 0,5
 * Lote 2 -> 5,10
 * Lote 3 -> 10,15
 */
const INDICE_DESDE = 0;
const INDICE_HASTA = 15;    

/**
 * Habilita o deshabilita la reconciliación en Firestore.
 */
const ESCRIBIR_FIRESTORE = true;


/**
 * Habilita o deshabilita la reconstrucción completa de la cartera.
 */
const FORZAR_BOOTSTRAP = true;

/**
 * Rango utilizado para reconstruir la cartera.
 * Debe cubrir todas las pólizas que todavía podrían estar vigentes.
 */
const FECHA_DESDE = "2025-08-04";
const FECHA_HASTA = "2026-08-04";


async function main(): Promise<void> {

    const inicioGeneral = Date.now();

    const productores: Productor[] = obtenerProductoresRUS1().slice(INDICE_DESDE, INDICE_HASTA)
        .map(productor => ({
            codigo: productor.codigo,
            nombre: productor.nombre.trim(),
            estado_id: productor.estado_id }));

    if (productores.length === 0) {
        console.log("No se encontraron productores activos para procesar.");
        return;
    }

    const rusSyncService = new RusSyncService();
    const polizaRepository = new FirestorePolizaRepository();
    const rusSyncStateRepository = new FirestoreRusSyncStateRepository();



    const errores: ErrorProductor[] = [];

    let productoresExitosos = 0;
    let productoresConError = 0;

    let totalPropuestasConsultadas = 0;
    let totalPropuestasVigentes = 0;
    let totalRiesgosDetectados = 0;

    let totalRiesgosActuales = 0;
    let totalRiesgosNuevos = 0;
    let totalRiesgosActualizados = 0;
    let totalRiesgosEliminados = 0;

    console.log("");
    console.log("==================================================");
    console.log("SINCRONIZACIÓN DE CARTERA RUS");
    console.log("==================================================");
    console.log(`Productores seleccionados: ${productores.length}`);
    console.log(`Fecha desde: ${FECHA_DESDE}`);
    console.log(`Fecha hasta: ${FECHA_HASTA}`);
    console.log(`Escribir Firestore: ${ESCRIBIR_FIRESTORE}`);
    console.log("==================================================");

    for (let indice = 0;  indice < productores.length; indice++) {

        const productor = productores[indice];

        const inicioProductor = Date.now();

        if(productor === undefined || productor.codigo === undefined || productor.nombre === undefined) {
            continue;
        }

        console.log("");
        console.log("--------------------------------------------------");
        console.log(`[${indice + 1}/${productores.length}] ` + `${productor.codigo} - ${productor.nombre}`);
        console.log("--------------------------------------------------");

        const ahora = new Date();

        const estadoAnterior =await rusSyncStateRepository.obtenerPorProductor(productor.codigo);

        let modoActual = ModoSincronizacionRus.BOOTSTRAP;
        let fechaDesdeActual = FECHA_DESDE;
        const fechaHastaActual = FECHA_HASTA;

        if (!FORZAR_BOOTSTRAP && estadoAnterior?.bootstrapCompleto === true && estadoAnterior.ultimaFechaProcesada) {
            modoActual = ModoSincronizacionRus.INCREMENTAL;
        
            fechaDesdeActual = restarDias(estadoAnterior.ultimaFechaProcesada,2
            );
        }

        console.log("Configuración seleccionada:");

        console.log({
            modo: modoActual,
            fechaDesde: fechaDesdeActual,
            fechaHasta: fechaHastaActual
        });

        if (estadoAnterior) {
            console.log("Estado anterior encontrado:");

            console.log({
                estado: estadoAnterior.estado,
                modo: estadoAnterior.modo,
                bootstrapCompleto: estadoAnterior.bootstrapCompleto,
                fechaDesde: estadoAnterior.fechaDesde,
                fechaHasta: estadoAnterior.fechaHasta,
                ultimaFechaProcesada: estadoAnterior.ultimaFechaProcesada
            });
        } else {
            console.log("No existe una sincronización previa para este productor.");
        }

        const estadoSincronizacion: RusSyncState = {
            id: rusSyncStateRepository.construirId(productor.codigo),

            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre
            },
            modo: modoActual,
            estado: EstadoSincronizacionRus.EN_PROCESO,
            bootstrapCompleto: estadoAnterior?.bootstrapCompleto ?? false,
            fechaDesde: fechaDesdeActual,
            fechaHasta: fechaHastaActual,
            ultimaFechaProcesada: estadoAnterior?.ultimaFechaProcesada ?? null,
            fechaInicio: ahora,
            fechaActualizacion: ahora
        };

        try {

            if (ESCRIBIR_FIRESTORE) {
                await rusSyncStateRepository.marcarEnProceso(estadoSincronizacion);
            }

            console.log("Reconstruyendo cartera de RUS...");

            const resultado = await rusSyncService.sincronizar(productor, fechaDesdeActual, fechaHastaActual, modoActual);



            totalPropuestasConsultadas += resultado.propuestasConsultadas;
            totalPropuestasVigentes += resultado.propuestasVigentes;
            totalRiesgosDetectados += resultado.riesgosDetectados;

            console.log("");
            console.log("RESULTADO DEL PRODUCTOR");

            console.log({
                propuestasConsultadas:resultado.propuestasConsultadas,
                propuestasVigentes:resultado.propuestasVigentes,
                riesgosDetectados:resultado.riesgosDetectados
            });

            if (resultado.polizas.length === 0) {
                console.log("No se detectaron pólizas riesgosas.");
            } else {

                console.log("");
                console.log("RIESGOS DETECTADOS");

                console.table(resultado.polizas.map(poliza => ({
                            id: poliza.id,
                            productor:poliza.productor.codigo,
                            cliente:poliza.cliente.nombre.trim(),
                            poliza:poliza.detallePoliza.numeroPoliza,
                            endoso:poliza.detallePoliza.endoso,
                            cobertura:poliza.riesgo.cobertura,
                            premio:poliza.riesgo.premio,
                            riesgos:poliza.riesgos.join(", "),
                            vigenciaDesde:formatearFecha(poliza.vigencia.desde),
                            vigenciaHasta:formatearFecha(poliza.vigencia.hasta),
                            diasParaVencer: poliza.vigencia.diasParaVencer
                        })
                    )
                );
            }

            if (!ESCRIBIR_FIRESTORE) {
                console.log("Modo diagnóstico: no se realizaron " +"escrituras en Firestore.");
                productoresExitosos++;
                continue;
            }

            console.log("");
            console.log("Sincronizando Firestore...");

            const resultFirestore = modoActual === ModoSincronizacionRus.BOOTSTRAP
                ? await polizaRepository.sincronizarRiesgosProductor(productor, ECompania.RIO_URUGUAY, resultado.polizas)
                : await polizaRepository.sincronizarRiesgosIncrementales(resultado.polizas);

            totalRiesgosActuales += resultFirestore.riesgosActuales;
            totalRiesgosNuevos += resultFirestore.riesgosNuevos;
            totalRiesgosActualizados += resultFirestore.riesgosActualizados;
            totalRiesgosEliminados += resultFirestore.riesgosEliminados;

            console.log("Sincronización Firestore finalizada.");

            console.log(resultFirestore);
            
            await rusSyncStateRepository.marcarCompletado(estadoSincronizacion);
            
            console.log("Estado de sincronización marcado como COMPLETADO.");
            productoresExitosos++;

        } catch (error: any) {

            productoresConError++;

            const errorProductor: ErrorProductor = {
                codigo: productor.codigo,
                nombre: productor.nombre,
                mensaje:error?.message ?? "Error desconocido",
                status:error?.response?.status,
                detalle:error?.response?.data
            };

            if (ESCRIBIR_FIRESTORE) {
                await rusSyncStateRepository.marcarError(estadoSincronizacion, errorProductor.mensaje);
            }

            errores.push(errorProductor);

            console.error("");
            console.error("ERROR EN SINCRONIZACIÓN DEL PRODUCTOR");

            console.error(errorProductor);

        } finally {

            const duracionProductor = Date.now() - inicioProductor;
            console.log(`Duración productor: ` + `${formatearDuracion(duracionProductor)}`);
        }
    }

    const duracionGeneral = Date.now() - inicioGeneral;

    console.log("");
    console.log("==================================================");
    console.log("RESUMEN GENERAL");
    console.log("==================================================");

    console.log({
        productoresTotales: productores.length,
        productoresExitosos,
        productoresConError,
        totalPropuestasConsultadas,
        totalPropuestasVigentes,
        totalRiesgosDetectados,
        totalRiesgosActuales,
        totalRiesgosNuevos,
        totalRiesgosActualizados,
        totalRiesgosEliminados,
        duracionTotal: formatearDuracion(duracionGeneral)
    });

    if (errores.length > 0) {

        console.log("");
        console.log("==================================================");
        console.log("PRODUCTORES CON ERROR");
        console.log("==================================================");

        console.table(errores.map(error => ({
                codigo: error.codigo,
                nombre: error.nombre,
                status: error.status ?? "sin status",
                mensaje: error.mensaje })));

        process.exitCode = 1;
    }
}


main().catch(error => {
    
    console.error("");
    console.error("ERROR GENERAL DEL PROCESO");
    console.error(error);

    process.exitCode = 1;
});
