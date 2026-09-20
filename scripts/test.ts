import "dotenv/config";

import { RusCarteraService } from "../src/companias/rus/services/rusCarteraService";


interface PolizaARevisar {
    numeroPoliza: number;
    codigoProductor: number;
    clienteFirestore: string;
}


interface ResultadoCheck {
    numeroPoliza: number;
    codigoProductor: number;
    clienteFirestore: string;
    nombrePersonaRus: string;
    razonSocialRus: string;
    clienteCorrectoRus: string;
    coincide: boolean;
}


/**
 * Pólizas RUS que detectamos con posibles nombres incompletos
 * almacenados actualmente en Firestore.
 */
const POLIZAS_A_REVISAR: PolizaARevisar[] = [

    {
        numeroPoliza: 13621564,
        codigoProductor: 8563,
        clienteFirestore: "MARIANO NICOLAS"
    },

    {
        numeroPoliza: 13765560,
        codigoProductor: 13540,
        clienteFirestore: "OMAR OSVALDO"
    },

    {
        numeroPoliza: 13654926,
        codigoProductor: 5319,
        clienteFirestore: "JOSE VICENTE"
    },

    {
        numeroPoliza: 13854183,
        codigoProductor: 5319,
        clienteFirestore: "YOACIL OSWALDO"
    }
];


/**
 * Construye el nombre del asegurado utilizando la misma regla
 * que actualmente utiliza RusPolizaMapper:
 *
 * - Si existen razón social/apellido y nombre:
 *      RAZON_SOCIAL + NOMBRE
 *
 * - Si solamente existe nombre:
 *      NOMBRE
 *
 * - Si solamente existe razón social:
 *      RAZON_SOCIAL
 */
function obtenerNombreCorrecto(
    nombrePersona?: string,
    razonSocial?: string
): string {

    const nombre =
        nombrePersona?.trim() ?? "";

    const razon =
        razonSocial?.trim() ?? "";

    if (nombre && razon) {
        return `${razon} ${nombre}`;
    }

    if (nombre) {
        return nombre;
    }

    if (razon) {
        return razon;
    }

    return "SIN NOMBRE";
}


/**
 * Normaliza texto para evitar considerar como diferentes
 * valores que solamente cambian en espacios o mayúsculas.
 */
function normalizar(texto: string): string {

    return texto
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}


async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("CHECK APELLIDOS RUS");
    console.log("==================================================");
    console.log("");
    console.log("Modo: SOLO LECTURA");
    console.log("No se realizarán escrituras en Firestore.");
    console.log("");


    const carteraService =
        new RusCarteraService();


    /*
     * Agrupamos por productor.
     *
     * Javier Fessel, por ejemplo, tiene dos pólizas.
     * De esta forma consultamos su cartera una sola vez.
     */
    const porProductor =
        new Map<number, PolizaARevisar[]>();


    for (const poliza of POLIZAS_A_REVISAR) {

        const actuales =
            porProductor.get(poliza.codigoProductor) ?? [];

        actuales.push(poliza);

        porProductor.set(
            poliza.codigoProductor,
            actuales
        );
    }


    const resultados: ResultadoCheck[] = [];


    /*
     * Usamos un rango suficientemente amplio para encontrar
     * las pólizas actuales.
     *
     * Como estamos en septiembre de 2026, consultamos desde
     * septiembre de 2025 hasta hoy.
     */
    const FECHA_DESDE = "2025-09-17";
    const FECHA_HASTA = "2026-09-17";


    for (const [codigoProductor, polizas] of porProductor) {

        console.log("");
        console.log("==================================================");
        console.log(`PRODUCTOR ${codigoProductor}`);
        console.log("==================================================");

        console.log(
            `Pólizas buscadas: ${polizas
                .map(p => p.numeroPoliza)
                .join(", ")}`
        );

        console.log(
            `Consultando RUS desde ${FECHA_DESDE} hasta ${FECHA_HASTA}...`
        );


        /*
         * Una única reconstrucción de cartera por productor.
         */
        const manager =
            await carteraService.obtenerCarteraPorRango(
                codigoProductor,
                FECHA_DESDE,
                FECHA_HASTA
            );


        console.log(
            `Propuestas obtenidas: ${manager.getCantidad()}`
        );


        for (const poliza of polizas) {

            /*
             * RusPropuestasManager ya tiene este método.
             */
            const propuesta =
                manager.getPropuesta(poliza.numeroPoliza);


            if (!propuesta) {

                console.log("");
                console.log(
                    `⚠ Póliza ${poliza.numeroPoliza} no encontrada.`
                );

                continue;
            }


            const nombrePersona =
                propuesta.nombrePersona?.trim() ?? "";

            const razonSocial =
                propuesta.razonSocial?.trim() ?? "";


            const clienteCorrectoRus =
                obtenerNombreCorrecto(
                    nombrePersona,
                    razonSocial
                );


            const coincide =
                normalizar(poliza.clienteFirestore)
                ===
                normalizar(clienteCorrectoRus);


            resultados.push({

                numeroPoliza:
                    poliza.numeroPoliza,

                codigoProductor:
                    poliza.codigoProductor,

                clienteFirestore:
                    poliza.clienteFirestore,

                nombrePersonaRus:
                    nombrePersona,

                razonSocialRus:
                    razonSocial,

                clienteCorrectoRus,

                coincide
            });


            console.log("");
            console.log("------------------------------------------");
            console.log(`Póliza: ${poliza.numeroPoliza}`);
            console.log("------------------------------------------");

            console.log(
                `nombrePersona RUS: ${nombrePersona || "-"}`
            );

            console.log(
                `razonSocial RUS:   ${razonSocial || "-"}`
            );

            console.log("");

            console.log(
                `Firestore: ${poliza.clienteFirestore}`
            );

            console.log(
                `Correcto:  ${clienteCorrectoRus}`
            );

            console.log(
                `Estado:    ${coincide ? "OK" : "CORREGIR"}`
            );
        }
    }


    console.log("");
    console.log("");
    console.log("==================================================");
    console.log("RESULTADO GENERAL");
    console.log("==================================================");
    console.log("");


    console.table(
        resultados.map(resultado => ({

            poliza:
                resultado.numeroPoliza,

            productor:
                resultado.codigoProductor,

            firestore:
                resultado.clienteFirestore,

            nombreRus:
                resultado.nombrePersonaRus,

            apellidoRazonSocial:
                resultado.razonSocialRus,

            correcto:
                resultado.clienteCorrectoRus,

            estado:
                resultado.coincide
                    ? "OK"
                    : "CORREGIR"
        }))
    );


    const correctas =
        resultados.filter(
            resultado => resultado.coincide
        );


    const incorrectas =
        resultados.filter(
            resultado => !resultado.coincide
        );


    console.log("");
    console.log("==================================================");
    console.log("RESUMEN");
    console.log("==================================================");

    console.log({
        polizasBuscadas:
            POLIZAS_A_REVISAR.length,

        polizasEncontradas:
            resultados.length,

        correctas:
            correctas.length,

        aCorregir:
            incorrectas.length,

        noEncontradas:
            POLIZAS_A_REVISAR.length -
            resultados.length
    });


    if (incorrectas.length > 0) {

        console.log("");
        console.log("==================================================");
        console.log("PÓLIZAS A CORREGIR");
        console.log("==================================================");
        console.log("");


        for (const resultado of incorrectas) {

            console.log(
                `${resultado.numeroPoliza}: ` +
                `"${resultado.clienteFirestore}" ` +
                `→ ` +
                `"${resultado.clienteCorrectoRus}"`
            );
        }
    }


    console.log("");
    console.log("==================================================");
    console.log("FIN DEL CHECK");
    console.log("==================================================");
}


main()
    .then(() => {

        console.log("");
        console.log(
            "Check finalizado correctamente."
        );

        process.exit(0);
    })
    .catch(error => {

        console.error("");
        console.error(
            "❌ Error ejecutando check de apellidos RUS:"
        );

        console.error(error);

        process.exit(1);
    });