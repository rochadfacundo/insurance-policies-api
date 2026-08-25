import "dotenv/config";

import { Productor } from "../src/models/productor";

import {
    MercantilSyncService
} from "../src/companias/mercantil/services/mercantilSyncService";

import {
    formatearDuracion
} from "../src/utils/utils";


interface CasoPrueba {
    productor: Productor;
    poliza: number;
    primaEsperada: number;
    premioEsperado: number;
    endosoEsperado: number;
}


const CASOS: CasoPrueba[] = [
    {
        productor: {
            codigo: 87077,
            nombre: "LEDESMA, FLORENCIA BEATRIZ",
            estado_id: 1
        },
        poliza: 516641066,
        primaEsperada: 152451.6,
        premioEsperado: 283772.28,
        endosoEsperado: 7
    },
    {
        productor: {
            codigo: 90494,
            nombre: "MEANDRI, ANDREA RINA",
            estado_id: 1
        },
        poliza: 516416032,
        primaEsperada: 8872906.08,
        premioEsperado: 15656775,
        endosoEsperado: 19
    }
];


function sonIgualesConTolerancia(
    valor1: number,
    valor2: number,
    tolerancia = 0.01
): boolean {

    return Math.abs(valor1 - valor2) <= tolerancia;
}


async function main(): Promise<void> {

    const inicioGeneral = Date.now();


    console.log("");
    console.log("==================================================");
    console.log("PRUEBA ANUALIZACIÓN MERCANTIL ANDINA");
    console.log("==================================================");

    console.log("");
    console.log("NO se realizarán escrituras en Firestore.");
    console.log("");


    const syncService =
        new MercantilSyncService();


    for (
        let indice = 0;
        indice < CASOS.length;
        indice++
    ) {

        const caso = CASOS[indice];

        if(!caso){
            continue;
        }

        console.log("");
        console.log("--------------------------------------------------");
        console.log(
            `[${indice + 1}/${CASOS.length}] ` +
            `Póliza ${caso.poliza} - Productor ${caso.productor.codigo}`
        );
        console.log("--------------------------------------------------");


        const inicioCaso = Date.now();


        const riesgos =
            await syncService.sincronizar(
                caso.productor
            );


        const poliza =
            riesgos.find(
                poliza =>
                    Number(
                        poliza.detallePoliza.numeroPoliza
                    ) === caso.poliza
            );


        if (!poliza) {

            console.log("");
            console.log(
                `La póliza ${caso.poliza} no apareció entre los riesgos.`
            );

            console.log(
                "Puede haberse procesado correctamente pero no haber quedado clasificada como riesgo."
            );

            continue;
        }


        const primaFinal =
            Number(poliza.riesgo.prima ?? 0);

        const premioFinal =
            Number(poliza.riesgo.premio ?? 0);

        const endosoActual =
            Number(
                poliza.detallePoliza.endoso ?? 0
            );


        const primaCorrecta =
            sonIgualesConTolerancia(
                primaFinal,
                caso.primaEsperada
            );

        const premioCorrecto =
            sonIgualesConTolerancia(
                premioFinal,
                caso.premioEsperado
            );

        const endosoCorrecto =
            endosoActual ===
            caso.endosoEsperado;


        console.log("");
        console.log("RESULTADO FINAL:");

        console.log({
            numeroPoliza:
                poliza.detallePoliza.numeroPoliza,

            endosoActual,

            cobertura:
                poliza.riesgo.cobertura,

            primaAnual:
                primaFinal,

            premioAnual:
                premioFinal,

            riesgos:
                poliza.riesgos,

            cliente:
                poliza.cliente.nombre
        });


        console.log("");
        console.log("VALIDACIONES:");

        console.log({
            endoso: {
                esperado:
                    caso.endosoEsperado,

                obtenido:
                    endosoActual,

                correcto:
                    endosoCorrecto
            },

            primaAnual: {
                esperada:
                    caso.primaEsperada,

                obtenida:
                    primaFinal,

                correcta:
                    primaCorrecta
            },

            premioAnual: {
                esperado:
                    caso.premioEsperado,

                obtenido:
                    premioFinal,

                correcto:
                    premioCorrecto
            },

            riesgos:
                poliza.riesgos
        });


        /**
         * Caso especial:
         *
         * La póliza 516416032 debería superar el umbral
         * de PRIMA_ALTA si el RiskEngine trabaja sobre
         * la prima anualizada.
         */
        if (caso.poliza === 516416032) {

            const tienePrimaAlta =
                poliza.riesgos.includes(
                    "PRIMA_ALTA" as any
                );


            console.log("");

            console.log("VALIDACIÓN PRIMA_ALTA:");

            console.log({
                esperado:
                    true,

                obtenido:
                    tienePrimaAlta,

                correcto:
                    tienePrimaAlta === true
            });
        }


        const pruebaCorrecta =
            endosoCorrecto &&
            primaCorrecta &&
            premioCorrecto;


        console.log("");
        console.log(
            pruebaCorrecta
                ? "PRUEBA CORRECTA"
                : "PRUEBA CON DIFERENCIAS"
        );


        console.log(
            `Duración caso: ` +
            `${formatearDuracion(Date.now() - inicioCaso)}`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("PRUEBA FINALIZADA");
    console.log("==================================================");

    console.log(
        `Duración total: ` +
        `${formatearDuracion(Date.now() - inicioGeneral)}`
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