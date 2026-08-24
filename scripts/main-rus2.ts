import "dotenv/config";

import { Productor } from "../src/models/productor";
import { RusSyncService } from "../src/companias/rus/services/rusSyncService";
import { ModoSincronizacionRus } from "../src/companias/rus/models/modoSincronizacionRus";
import { formatearDuracion } from "../src/utils/utils";


/**
 * ============================================================
 * PRUEBA INCREMENTAL RUS
 * ============================================================
 *
 * Objetivo:
 *
 * Simular un incremental donde SOLO aparece el endoso actual,
 * sin incluir el endoso 0 dentro del rango consultado.
 *
 * Esperamos que RusCarteraService:
 *
 * 1. detecte que el endoso actual es > 0;
 * 2. consulte directamente el detalle del endoso 0;
 * 3. recupere premioPoliza;
 * 4. mantenga el endoso actual;
 * 5. termine mapeando el premio correcto.
 *
 * NO escribe Firestore.
 */


const PRODUCTOR: Productor = {
    codigo: 5319,
    nombre: "Productor 5319",
    estado_id: 1
};


const POLIZA_OBJETIVO = 13654926;


/**
 * Esta póliza apareció con el endoso 1 alrededor del 30/05/2026.
 *
 * Dejamos un rango muy corto para evitar que entre el endoso 0.
 */
const FECHA_DESDE = "2026-05-25";
const FECHA_HASTA = "2026-06-10";


async function main(): Promise<void> {

    const inicio = Date.now();


    console.log("");
    console.log("==================================================");
    console.log("PRUEBA INCREMENTAL RUS");
    console.log("==================================================");

    console.log({
        productor: PRODUCTOR.codigo,
        polizaObjetivo: POLIZA_OBJETIVO,
        fechaDesde: FECHA_DESDE,
        fechaHasta: FECHA_HASTA
    });

    console.log("");
    console.log("NO se realizarán escrituras en Firestore.");
    console.log("");


    const rusSyncService = new RusSyncService();


    /**
     * Ejecutamos explícitamente en modo incremental.
     */
    const resultado = await rusSyncService.sincronizar(
        PRODUCTOR,
        FECHA_DESDE,
        FECHA_HASTA,
        "INCREMENTAL" as ModoSincronizacionRus
    );


    console.log("");
    console.log("==================================================");
    console.log("RESULTADO GENERAL");
    console.log("==================================================");

    console.log({
        propuestasConsultadas:
            resultado.propuestasConsultadas,

        propuestasVigentes:
            resultado.propuestasVigentes,

        riesgosDetectados:
            resultado.riesgosDetectados,

        polizasDevueltas:
            resultado.polizas.length
    });


    /**
     * ========================================================
     * BUSCAMOS LA PÓLIZA OBJETIVO
     * ========================================================
     */

    const poliza = resultado.polizas.find(
        poliza =>
            Number(poliza.detallePoliza.numeroPoliza) ===
            POLIZA_OBJETIVO
    );


    console.log("");
    console.log("==================================================");
    console.log(`PÓLIZA OBJETIVO ${POLIZA_OBJETIVO}`);
    console.log("==================================================");


    if (!poliza) {

        console.log("");
        console.log("La póliza objetivo no apareció.");

        console.log("");
        console.log(
            "Revisá arriba si RUS devolvió la propuesta " +
            "dentro de este rango."
        );

        return;
    }


    console.log("");
    console.log("RESULTADO FINAL:");

    console.log({
        id:
            poliza.id,

        numeroPoliza:
            poliza.detallePoliza.numeroPoliza,

        endosoActual:
            poliza.detallePoliza.endoso,

        premioFinal:
            poliza.riesgo.premio,

        riesgos:
            poliza.riesgos,

        cliente:
            poliza.cliente.nombre
    });


    console.log("");
    console.log("Objeto completo:");

    console.dir(
        poliza,
        {
            depth: null,
            colors: true
        }
    );


    /**
     * ========================================================
     * VALIDACIONES
     * ========================================================
     */

    const endosoCorrecto =
        Number(poliza.detallePoliza.endoso) === 1;


    const premioCorrecto =
        Number(poliza.riesgo.premio) === 2988000;


    const tieneFlota =
        poliza.riesgos.includes("FLOTA" as any);


    console.log("");
    console.log("==================================================");
    console.log("VALIDACIONES");
    console.log("==================================================");

    console.log({
        endosoActual: {
            esperado: 1,
            obtenido: poliza.detallePoliza.endoso,
            correcto: endosoCorrecto
        },

        premioPoliza: {
            esperado: 2988000,
            obtenido: poliza.riesgo.premio,
            correcto: premioCorrecto
        },

        flota: {
            esperado: true,
            obtenido: tieneFlota,
            correcto: tieneFlota
        }
    });


    const pruebaCorrecta =
        endosoCorrecto &&
        premioCorrecto &&
        tieneFlota;


    console.log("");
    console.log("==================================================");


    if (pruebaCorrecta) {

        console.log("PRUEBA INCREMENTAL CORRECTA");

        console.log("");

        console.log(
            "El rango incremental no contenía el endoso 0, " +
            "pero RusCarteraService recuperó correctamente " +
            "el premio base de la póliza."
        );

    } else {

        console.log("PRUEBA INCREMENTAL CON DIFERENCIAS");

        console.log("");

        console.log(
            "Alguno de los valores no coincide con lo esperado."
        );
    }


    console.log("==================================================");


    const duracion =
        Date.now() - inicio;


    console.log("");
    console.log(
        `Duración total: ${formatearDuracion(duracion)}`
    );
}


main().catch(error => {

    console.error("");
    console.error("ERROR GENERAL DE LA PRUEBA INCREMENTAL");

    console.error(error);

    process.exitCode = 1;
});