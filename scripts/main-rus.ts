import "dotenv/config";

import { Productor } from "../src/models/productor";
import { RusSyncService } from "../src/companias/rus/services/rusSyncService";
import { FirestorePolizaRepository } from "../src/repositories/firestorePolizaRepository";
import { ECompania } from "../src/models/eCompania";

const productor: Productor = {
    codigo: 8381,
    nombre: "Tecnica y servicios",
    estado_id: 0
};

/**
 * Primero sin escribir en Firestore.
 */
const ESCRIBIR_FIRESTORE = true;

/**
 * Rango utilizado para reconstruir la cartera.
 *
 * Debe cubrir todas las pólizas que todavía podrían estar vigentes.
 * Para la prueba inicial usamos el último año.
 */
const FECHA_DESDE = "2025-07-27";
const FECHA_HASTA = "2026-07-27";

async function main(): Promise<void> {

    const inicio = Date.now();

    console.log("");
    console.log("==================================================");
    console.log("PRUEBA DE SINCRONIZACIÓN RUS");
    console.log("==================================================");
    console.log(`Productor: ${productor.codigo} - ${productor.nombre}`);
    console.log(`Fecha desde: ${FECHA_DESDE}`);
    console.log(`Fecha hasta: ${FECHA_HASTA}`);
    console.log(`Escribir Firestore: ${ESCRIBIR_FIRESTORE}`);
    console.log("==================================================");
    console.log("");

    try {

        const rusSyncService = new RusSyncService();

        console.log("Reconstruyendo cartera de RUS...");

        const resultado = await rusSyncService.sincronizar(productor,FECHA_DESDE, FECHA_HASTA);

        console.log("");
        console.log("==================================================");
        console.log("RESULTADO");
        console.log("==================================================");

        console.log({
            propuestasConsultadas:resultado.propuestasConsultadas,
            propuestasVigentes:resultado.propuestasVigentes,
            riesgosDetectados:resultado.riesgosDetectados
        });

        console.log("");
        console.log("==================================================");
        console.log("RIESGOS DETECTADOS");
        console.log("==================================================");

        if (resultado.polizas.length === 0) {

            console.log("No se detectaron pólizas riesgosas.");

        } else {

            console.table(resultado.polizas.map(
                    poliza => ({
                        id: poliza.id,
                        productor: poliza.productor.codigo,
                        cliente: poliza.cliente.nombre,
                        poliza: poliza.detallePoliza.numeroPoliza,
                        endoso: poliza.detallePoliza.endoso,
                        cobertura: poliza.riesgo.cobertura,
                        premio: poliza.riesgo.premio,
                        riesgos: poliza.riesgos.join(", "),
                        vigenciaDesde: formatearFecha(poliza.vigencia.desde),
                        vigenciaHasta: formatearFecha(poliza.vigencia.hasta ),
                        diasParaVencer: poliza.vigencia.diasParaVencer
                    })
                )
            );

            console.log("");
            console.log("DOCUMENTOS COMPLETOS");
            console.log(JSON.stringify(resultado.polizas,reemplazarFechas,2));
        }

        if (!ESCRIBIR_FIRESTORE) {

            console.log("");
            console.log("==================================================");
            console.log("MODO DIAGNÓSTICO");
            console.log("==================================================");
            console.log("No se realizaron escrituras en Firestore.");

            return;
        }

        /*
         * La escritura en Firestore se agrega
         * después de validar correctamente el resultado.
         */
        const polizaRepository = new FirestorePolizaRepository();

        console.log("");
        console.log("==================================================");
        console.log("SINCRONIZANDO FIRESTORE");
        console.log("==================================================");

        const resultadoFirestore = await polizaRepository.sincronizarRiesgosProductor(productor, ECompania.RIO_URUGUAY,resultado.polizas);

        console.log("Sincronización Firestore finalizada.");
        console.log(resultadoFirestore);

    } catch (error: any) {

        console.error("");
        console.error("==================================================");
        console.error("ERROR EN SINCRONIZACIÓN RUS");
        console.error("==================================================");

        console.error({
            productor: productor.codigo,
            nombre: productor.nombre,
            mensaje: error?.message ?? "Error desconocido",
            status: error?.response?.status,
            detalle: error?.response?.data
        });

        process.exitCode = 1;

    } finally {

        const duracionMs = Date.now() - inicio;

        console.log("");
        console.log(`Duración: ${formatearDuracion(duracionMs)}`);
    }
}

function formatearFecha(fecha: Date | string | undefined): string {

    if (!fecha) {
        return "";
    }

    const fechaNormalizada = fecha instanceof Date ? fecha : new Date(fecha);

    if (Number.isNaN(fechaNormalizada.getTime())) {
        return String(fecha);
    }

    return fechaNormalizada.toISOString().substring(0, 10);
}

function reemplazarFechas(_clave: string,valor: unknown): unknown {

    if (valor instanceof Date) {
        return valor.toISOString();
    }

    return valor;
}

function formatearDuracion(duracionMs: number): string {

    const segundosTotales = Math.floor(duracionMs / 1000);

    const minutos = Math.floor(segundosTotales / 60);

    const segundos = segundosTotales % 60;

    return `${minutos}m ${segundos}s`;
}

main();