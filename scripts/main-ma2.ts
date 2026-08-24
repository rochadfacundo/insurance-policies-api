import "dotenv/config";

import {
    Productor
} from "../src/models/productor";

import {
    MercantilSyncService
} from "../src/companias/mercantil/services/mercantilSyncService";

import {
    formatearDuracion
} from "../src/utils/utils";


/**
 * ============================================================
 * PRUEBA INTEGRACIÓN COMPLETA MERCANTIL ANDINA
 * ============================================================
 *
 * Objetivo:
 *
 * Validar el flujo real:
 *
 * cartera
 *   ↓
 * detalle actual
 *   ↓
 * última facturación
 *   ↓
 * bienes actuales
 *   ↓
 * mapper
 *   ↓
 * risk engine
 *
 * Para la póliza 516641066 esperamos:
 *
 * - endoso actual: 7
 * - última facturación: endoso 6
 * - prima final: 12704.30
 * - premio final: 23647.69
 *
 * NO escribe Firestore.
 */


const PRODUCTOR: Productor = {
    codigo: 90494,
    nombre: "MEANDRI, ANDREA RINA",
    estado_id: 1
};

const POLIZA_OBJETIVO = 516416032;




async function main(): Promise<void> {

    const inicio = Date.now();


    console.log("");
    console.log("==================================================");
    console.log("PRUEBA INTEGRACIÓN MERCANTIL ANDINA");
    console.log("==================================================");

    console.log({
        productor: PRODUCTOR.codigo,
        nombre: PRODUCTOR.nombre,
        polizaObjetivo: POLIZA_OBJETIVO
    });

    console.log("");
    console.log("NO se realizarán escrituras en Firestore.");
    console.log("");


    const syncService =
        new MercantilSyncService();


    /**
     * Ejecutamos el flujo productivo real.
     *
     * El servicio debería:
     *
     * - conservar el endoso actual;
     * - buscar hacia atrás la última FACTURACION;
     * - mapear prima/premio desde esa facturación;
     * - ejecutar RiskEngine.
     */
    const riesgos =
        await syncService.sincronizar(
            PRODUCTOR
        );


    console.log("");
    console.log("==================================================");
    console.log("RESULTADO GENERAL");
    console.log("==================================================");

    console.log({
        riesgosDetectados:
            riesgos.length
    });


    /**
     * ========================================================
     * BUSCAR PÓLIZA OBJETIVO
     * ========================================================
     */

    const poliza =
        riesgos.find(
            poliza =>
                Number(
                    poliza.detallePoliza.numeroPoliza
                ) === POLIZA_OBJETIVO
        );


    console.log("");
    console.log("==================================================");
    console.log(
        `PÓLIZA OBJETIVO ${POLIZA_OBJETIVO}`
    );
    console.log("==================================================");


    if (!poliza) {

        console.log("");
        console.log(
            "La póliza objetivo no apareció entre los riesgos."
        );

        console.log("");
        console.log(
            "Esto puede significar que fue procesada correctamente, " +
            "pero MercantilRiskEngine no detectó ningún riesgo."
        );

        console.log("");
        console.log(
            "Si ocurre eso, debemos probar el mapper directamente " +
            "sin pasar por RiskEngine."
        );

        return;
    }


    /**
     * ========================================================
     * RESULTADO FINAL
     * ========================================================
     */

    console.log("");
    console.log("RESULTADO FINAL:");

    console.log({
        id:
            poliza.id,

        numeroPoliza:
            poliza.detallePoliza.numeroPoliza,

        endosoActual:
            poliza.detallePoliza.endoso,

        cobertura:
            poliza.riesgo.cobertura,

        primaFinal:
            poliza.riesgo.prima,

        premioFinal:
            poliza.riesgo.premio,

        riesgos:
            poliza.riesgos,

        cliente:
            poliza.cliente.nombre,

        vigenciaDesde:
            poliza.vigencia.desde,

        vigenciaHasta:
            poliza.vigencia.hasta
    });


    console.log("");
    console.log("Objeto Poliza completo:");

    console.dir(
        poliza,
        {
            depth: null,
            colors: true
        }
    );

    console.log("");
console.log("==================================================");
console.log("VALIDACIONES");
console.log("==================================================");

console.log({
    endosoActual:
        poliza.detallePoliza.endoso,

    primaFinal:
        poliza.riesgo.prima,

    premioFinal:
        poliza.riesgo.premio,

    cobertura:
        poliza.riesgo.cobertura,

    riesgos:
        poliza.riesgos
});

console.log("");
console.log("==================================================");
console.log("PRUEBA DE INTEGRACIÓN FINALIZADA");
console.log("==================================================");


    console.log("");
    console.log("==================================================");




    console.log("==================================================");


    console.log("");
    console.log(
        `Duración total: ` +
        `${formatearDuracion(Date.now() - inicio)}`
    );
}


main().catch(error => {

    console.error("");
    console.error(
        "ERROR GENERAL DE LA PRUEBA MERCANTIL"
    );

    console.error(error);

    process.exitCode = 1;
});