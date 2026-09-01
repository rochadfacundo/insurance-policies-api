import fs from "fs";
import path from "path";

import {
    obtenerProductoresMercantil
} from "../src/companias/mercantil/models/productoresMercantil";

import {
    obtenerProductoresRUS
} from "../src/companias/rus/productoresRUS";


interface ProductorMA {
    codigo: number;
    nombre: string;
    estado_id?: number;
    matricula: number | null;
    grupoCartera?: string;
}

interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id?: number;
}

interface ProductorRUSConciliado extends ProductorRUS {
    matricula: number | null;
    grupoCartera?: string;
}

interface CandidatoProbable {
    rus: ProductorRUS;
    mercantil: ProductorMA;
    puntaje: number;
}

interface AjusteManual {
    matricula?: number;
    grupoCartera?: string;
    nombre?: string;
}


/*
 * Ajustes que ya revisamos manualmente.
 *
 * Pueden definir:
 *
 * - matricula
 * - grupoCartera
 * - nombre
 *
 * No significa que todos deban tener los tres campos.
 */
const AJUSTES_MANUALES: Record<number, AjusteManual> = {

    /*
     * Demarchi
     */
    4505: {
        matricula: 68760
    },

    13278: {
        matricula: 68760
    },


    /*
     * Natalia Ferraiuolo
     */
    7749: {
        matricula: 88414
    },


    /*
     * Fridson
     */
    7954: {
        matricula: 89687
    },


    /*
     * Turolla Gerardo Pablo
     */
    9406: {
        matricula: 53375
    },

    10536: {
        matricula: 53375
    },


    /*
     * Rebman
     */
    10302: {
        matricula: 95657
    },


    /*
     * Oggero
     */
    10571: {
        matricula: 41929
    },


    /*
     * Di Fiore
     */
    11049: {
        matricula: 98612
    },


    /*
     * Ferreiro
     */
    11449: {
        matricula: 99192
    },


    /*
     * Andrea Marine Gomez
     */
    12982: {
        matricula: 93032
    },


    /*
     * Villalba
     */
    13510: {
        matricula: 100225
    },


    /*
     * Tahiel Carneiro
     *
     * Los nombres RUS son distintos, por eso
     * el algoritmo no los detecta como cuentas múltiples.
     *
     * Los separamos explícitamente.
     */
    10107: {
        grupoCartera: "96252_CTA_1",
        nombre: "Tahiel Carneiro CTA 1"
    },

    13777: {
        matricula: 96252,
        grupoCartera: "96252_CTA_2",
        nombre: "Carneiro Tahiel Nicolas CTA 2"
    },


    /*
     * Aguilar Ramirez
     */
    15310: {
        matricula: 103010
    },


    /*
     * Ogni
     */
    17048: {
        matricula: 105410
    },


    /*
     * Maffoni
     */
    17280: {
        matricula: 104193
    }
};


const RUTA_SALIDA =
    path.resolve(
        __dirname,
        "../src/companias/rus/data/productoresRUS-conciliado-v4.json"
    );


function normalizarNombre(
    nombre: string
): string {

    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\bCTA\s*\d+\b/g, "")
        .replace(/\bCT\s*\d+\b/g, "")
        .replace(/\bC\d+\b/g, "")
        .replace(/S\.?R\.?L\.?/g, "")
        .replace(/[^A-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function obtenerPalabras(
    nombre: string
): string[] {

    return normalizarNombre(nombre)
        .split(" ")
        .filter(
            palabra =>
                palabra.length > 1
        );
}


function calcularSimilitud(
    nombreA: string,
    nombreB: string
): number {

    const palabrasA =
        obtenerPalabras(nombreA);

    const palabrasB =
        obtenerPalabras(nombreB);


    if (
        palabrasA.length === 0 ||
        palabrasB.length === 0
    ) {
        return 0;
    }


    const setA =
        new Set(palabrasA);

    const setB =
        new Set(palabrasB);


    let coincidencias = 0;


    for (const palabra of setA) {

        if (setB.has(palabra)) {
            coincidencias++;
        }
    }


    const minimo =
        Math.min(
            setA.size,
            setB.size
        );


    return coincidencias / minimo;
}


function encontrarCandidatoProbable(
    productorRUS: ProductorRUS,
    productoresMA: ProductorMA[]
): CandidatoProbable | null {

    const candidatos =
        productoresMA
            .filter(
                productor =>
                    productor.matricula !== null
            )
            .map(
                productor => ({
                    rus: productorRUS,
                    mercantil: productor,
                    puntaje:
                        calcularSimilitud(
                            productorRUS.nombre,
                            productor.nombre
                        )
                })
            )
            .filter(
                candidato =>
                    candidato.puntaje >= 0.66
            )
            .sort(
                (a, b) =>
                    b.puntaje -
                    a.puntaje
            );


    const mejor =
        candidatos[0];


    if (!mejor) {
        return null;
    }


    const segundo =
        candidatos[1];


    if (
        segundo &&
        segundo.puntaje === mejor.puntaje
    ) {
        return null;
    }


    return mejor;
}


async function main(): Promise<void> {

    const productoresMA =
        obtenerProductoresMercantil();


    const productoresRUS =
        obtenerProductoresRUS()
            .filter(
                productor =>
                    productor.estado_id === 1
            );


    /*
     * Mercantil agrupado por nombre normalizado.
     */
    const mercantilPorNombre =
        new Map<string, ProductorMA[]>();


    for (const productor of productoresMA) {

        const clave =
            normalizarNombre(
                productor.nombre
            );


        const grupo =
            mercantilPorNombre.get(clave) ?? [];


        grupo.push(productor);


        mercantilPorNombre.set(
            clave,
            grupo
        );
    }


    /*
     * RUS agrupado por nombre normalizado.
     *
     * Esto sigue resolviendo automáticamente
     * casos como:
     *
     * Goenaga
     * Roselli
     * Carranza
     * Vales
     * Manfredi
     * etc.
     */
    const rusPorNombre =
        new Map<string, ProductorRUS[]>();


    for (const productor of productoresRUS) {

        const clave =
            normalizarNombre(
                productor.nombre
            );


        const grupo =
            rusPorNombre.get(clave) ?? [];


        grupo.push(productor);


        rusPorNombre.set(
            clave,
            grupo
        );
    }


    const resultado: ProductorRUSConciliado[] = [];

    const exactosConMatricula: ProductorRUS[] = [];

    const exactosSinMatricula: ProductorRUS[] = [];

    const candidatosProbables: CandidatoProbable[] = [];

    const sinMatch: ProductorRUS[] = [];

    const matriculasConfirmadasManualmente: ProductorRUS[] = [];

    const gruposAjustadosManualmente: ProductorRUS[] = [];


    for (const productorRUS of productoresRUS) {

        const clave =
            normalizarNombre(
                productorRUS.nombre
            );


        const coincidenciasExactas =
            mercantilPorNombre.get(clave) ?? [];


        const ajusteManual =
            AJUSTES_MANUALES[
                productorRUS.codigo
            ];


        let matricula: number | null =
            null;


        /*
         * 1) Matrícula manual confirmada.
         */
        if (
            ajusteManual?.matricula !== undefined
        ) {

            matricula =
                ajusteManual.matricula;


            matriculasConfirmadasManualmente.push(
                productorRUS
            );

        } else {

            /*
             * 2) Match exacto por nombre.
             */
            const matriculasExactas =
                Array.from(
                    new Set(
                        coincidenciasExactas
                            .map(
                                productor =>
                                    productor.matricula
                            )
                            .filter(
                                (valor):
                                    valor is number =>
                                        valor !== null
                            )
                    )
                );


            if (
                matriculasExactas.length === 1
            ) {

                matricula =
                    matriculasExactas[0] ?? null;


                exactosConMatricula.push(
                    productorRUS
                );

            } else if (
                coincidenciasExactas.length > 0
            ) {

                exactosSinMatricula.push(
                    productorRUS
                );

            } else {

                /*
                 * 3) Buscamos candidato probable.
                 *
                 * Solamente se informa.
                 * Nunca asignamos matrícula.
                 */
                const candidato =
                    encontrarCandidatoProbable(
                        productorRUS,
                        productoresMA
                    );


                if (candidato) {

                    candidatosProbables.push(
                        candidato
                    );

                } else {

                    sinMatch.push(
                        productorRUS
                    );
                }
            }
        }


        const grupoRUS =
            rusPorNombre.get(clave) ?? [];


        const nuevoProductor: ProductorRUSConciliado = {

            ...productorRUS,

            matricula
        };


        /*
         * 4) Nombre manual.
         */
        if (ajusteManual?.nombre) {

            nuevoProductor.nombre =
                ajusteManual.nombre;
        }


        /*
         * 5) grupoCartera manual.
         *
         * Tiene PRIORIDAD sobre el agrupamiento automático.
         */
        if (ajusteManual?.grupoCartera) {

            nuevoProductor.grupoCartera =
                ajusteManual.grupoCartera;


            gruposAjustadosManualmente.push(
                productorRUS
            );

        } else if (grupoRUS.length > 1) {

            /*
             * 6) Múltiples códigos con mismo nombre RUS.
             *
             * Cada código queda como una cuenta independiente.
             */
            const indice =
                grupoRUS.findIndex(
                    productor =>
                        productor.codigo ===
                        productorRUS.codigo
                ) + 1;


            nuevoProductor.nombre =
                `${productorRUS.nombre} CTA ${indice}`;


            nuevoProductor.grupoCartera =
                matricula !== null
                    ? `${matricula}_CTA_${indice}`
                    : `RUS_${productorRUS.codigo}_CTA_${indice}`;
        }


        resultado.push(
            nuevoProductor
        );
    }


    fs.writeFileSync(
        RUTA_SALIDA,
        JSON.stringify(
            resultado,
            null,
            4
        ),
        "utf8"
    );


    console.log("");
    console.log("==================================================");
    console.log("CONCILIACIÓN MERCANTIL -> RUS V4");
    console.log("==================================================");

    console.log({

        productoresMercantil:
            productoresMA.length,

        productoresRUS:
            productoresRUS.length,

        exactosConMatricula:
            exactosConMatricula.length,

        matriculasConfirmadasManualmente:
            matriculasConfirmadasManualmente.length,

        exactosSinMatricula:
            exactosSinMatricula.length,

        candidatosProbables:
            candidatosProbables.length,

        sinMatch:
            sinMatch.length,

        gruposAjustadosManualmente:
            gruposAjustadosManualmente.length
    });


    console.log("");
    console.log("==================================================");
    console.log("MATCH EXACTO PERO MA SIN MATRÍCULA");
    console.log("==================================================");


    for (
        const productor
        of exactosSinMatricula
    ) {

        console.log(
            `${productor.codigo} - ${productor.nombre}`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("POSIBLES MATCHES PARA REVISAR");
    console.log("==================================================");


    for (
        const candidato
        of candidatosProbables
    ) {

        console.log("");

        console.log(
            `RUS: ${candidato.rus.codigo} - ${candidato.rus.nombre}`
        );

        console.log(
            `MA : ${candidato.mercantil.codigo} - ` +
            `${candidato.mercantil.nombre}`
        );

        console.log(
            `Matrícula MA: ${candidato.mercantil.matricula}`
        );

        console.log(
            `Similitud: ${(candidato.puntaje * 100).toFixed(0)}%`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("SIN MATCH");
    console.log("==================================================");


    for (
        const productor
        of sinMatch
    ) {

        console.log(
            `${productor.codigo} - ${productor.nombre}`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("MATRÍCULAS CONFIRMADAS MANUALMENTE");
    console.log("==================================================");


    for (
        const productor
        of matriculasConfirmadasManualmente
    ) {

        console.log(
            `${productor.codigo} - ` +
            `${productor.nombre} -> ` +
            `${AJUSTES_MANUALES[productor.codigo]?.matricula}`
        );
    }


    console.log("");
    console.log("==================================================");
    console.log("GRUPOS AJUSTADOS MANUALMENTE");
    console.log("==================================================");


    for (
        const productor
        of gruposAjustadosManualmente
    ) {

        console.log(
            `${productor.codigo} - ` +
            `${productor.nombre} -> ` +
            `${AJUSTES_MANUALES[productor.codigo]?.grupoCartera}`
        );
    }


    console.log("");
    console.log(
        `Archivo generado: ${RUTA_SALIDA}`
    );
}


main()
    .then(() => {

        console.log("");
        console.log(
            "Proceso finalizado."
        );

    })
    .catch(
        (error: unknown) => {

            console.error("");
            console.error(
                "Error conciliando productores."
            );

            console.error(
                error
            );

            process.exitCode = 1;
        }
    );