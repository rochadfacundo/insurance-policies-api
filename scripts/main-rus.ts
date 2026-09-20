import dotenv from "dotenv";

import {
    RusCarteraService
} from "../src/companias/rus/services/rusCarteraService";

import {
    RusPropuesta
} from "../src/companias/rus/models/rusPropuestasInterfaces";


dotenv.config({
    path: "../.env"
});


/*
 * Penedo Estela Virginia
 */
const CODIGO_PRODUCTOR = 10615;


/*
 * Pólizas que Mica detectó con el nombre incompleto.
 */
const POLIZAS_BUSCADAS = [
    13561565,
    13576301
];


/*
 * Rango suficientemente amplio para encontrar
 * las propuestas de estas pólizas.
 */
const FECHA_DESDE = "2026-01-01";
const FECHA_HASTA = "2026-09-17";


/**
 * Muestra los datos que RUS devuelve para una propuesta.
 *
 * IMPORTANTE:
 * Acá todavía estamos trabajando con RusPropuesta.
 * No pasó por RusPolizaMapper ni por Firestore.
 */
function mostrarPropuesta(
    propuesta: RusPropuesta
): void {

    console.log("");
    console.log("==================================================");
    console.log(`PÓLIZA ${propuesta.numeroPoliza}`);
    console.log("==================================================");

    console.log(`Endoso:        ${propuesta.endoso}`);
    console.log(`Propuesta:     ${propuesta.propuesta}`);
    console.log(`Renovación:    ${propuesta.renovacion}`);

    console.log("");
    console.log("DATOS DEL ASEGURADO DEVUELTOS POR RUS");
    console.log("------------------------------------------");

    console.log(
        `nombrePersona: "${propuesta.nombrePersona ?? ""}"`
    );

    console.log(
        `razonSocial:   "${propuesta.razonSocial ?? ""}"`
    );

    console.log(
        `idSocio:       ${propuesta.idSocio}`
    );

    console.log(
        `docPersona:    ${propuesta.docPersona}`
    );

    console.log(
        `cuit:          ${propuesta.cuit}`
    );


    /*
     * Mostramos el objeto ENTERO.
     *
     * Esto es importante porque si RUS devuelve
     * alguna propiedad que no tenemos declarada
     * en RusPropuesta, igualmente debería aparecer
     * acá en runtime.
     */
    console.log("");
    console.log("OBJETO COMPLETO DEVUELTO POR RUS");
    console.log("------------------------------------------");

    console.dir(
        propuesta,
        {
            depth: null,
            colors: true
        }
    );
}


async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("DIAGNÓSTICO DATOS CRUDOS RUS");
    console.log("==================================================");

    console.log("");
    console.log(`Productor:   ${CODIGO_PRODUCTOR}`);
    console.log(`Desde:       ${FECHA_DESDE}`);
    console.log(`Hasta:       ${FECHA_HASTA}`);
    console.log("Modo:        SOLO LECTURA");
    console.log("");


    const carteraService =
        new RusCarteraService();


    /*
     * Este método EXISTE en RusCarteraService.
     *
     * Consulta RUS y devuelve RusPropuestasManager.
     */
    const manager =
        await carteraService.obtenerCarteraPorRango(
            CODIGO_PRODUCTOR,
            FECHA_DESDE,
            FECHA_HASTA
        );


    /*
     * Obtenemos las RusPropuesta.
     *
     * Todavía no estamos usando RusPolizaMapper.
     */
    const propuestas: RusPropuesta[] =
        manager.getPropuestas();


    console.log("");
    console.log("==================================================");
    console.log("RESULTADO DE LA CONSULTA");
    console.log("==================================================");

    console.log(
        `Propuestas obtenidas: ${propuestas.length}`
    );


    /*
     * Buscamos solamente las pólizas que queremos revisar.
     */
    const encontradas: RusPropuesta[] =
        propuestas.filter(
            (propuesta: RusPropuesta) =>
                POLIZAS_BUSCADAS.includes(
                    propuesta.numeroPoliza
                )
        );


    console.log(
        `Pólizas encontradas:   ${encontradas.length}`
    );


    /*
     * Mostramos las propuestas encontradas.
     */
    for (const propuesta of encontradas) {

        mostrarPropuesta(
            propuesta
        );
    }


    /*
     * Control individual para saber si alguna
     * de las pólizas no apareció.
     */
    console.log("");
    console.log("");
    console.log("==================================================");
    console.log("CONTROL");
    console.log("==================================================");


    for (const numeroPoliza of POLIZAS_BUSCADAS) {

        const encontrada =
            encontradas.some(
                (propuesta: RusPropuesta) =>
                    propuesta.numeroPoliza ===
                    numeroPoliza
            );


        console.log(
            `${encontrada ? "✓" : "❌"} Póliza ${numeroPoliza}`
        );
    }


    /*
     * Resumen cómodo para comparar nombrePersona
     * contra razonSocial.
     */
    console.log("");
    console.log("");
    console.log("==================================================");
    console.log("RESUMEN ASEGURADOS");
    console.log("==================================================");

    console.table(
        encontradas.map(
            (propuesta: RusPropuesta) => ({
                poliza:
                    propuesta.numeroPoliza,

                endoso:
                    propuesta.endoso,

                nombrePersona:
                    propuesta.nombrePersona,

                razonSocial:
                    propuesta.razonSocial,

                documento:
                    propuesta.docPersona,

                cuit:
                    propuesta.cuit,

                idSocio:
                    propuesta.idSocio
            })
        )
    );


    console.log("");
    console.log("==================================================");
    console.log("FIN");
    console.log("==================================================");
}


main()
    .then(() => {

        console.log("");
        console.log(
            "Proceso finalizado correctamente."
        );

        process.exit(0);
    })
    .catch(error => {

        console.error("");
        console.error(
            "❌ Error consultando RUS:"
        );

        console.error(error);

        process.exit(1);
    });