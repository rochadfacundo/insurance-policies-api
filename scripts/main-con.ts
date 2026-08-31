import fs from "fs";
import path from "path";

import { Productor } from "../src/models/productor";


interface MatriculaMercantil {
    codigo: number;
    matricula: number | null;
}


async function main(): Promise<void> {

    const rutaProductores =
        path.resolve(
            __dirname,
            "../src/companias/mercantil/models/data/productoresMA.json"
        );

    const rutaMatriculas =
        path.resolve(
            __dirname,
            "../src/companias/mercantil/models/data/matriculasMA.json"
        );


    const productores: Productor[] =
        JSON.parse(
            fs.readFileSync(
                rutaProductores,
                "utf8"
            )
        );


    const matriculas: MatriculaMercantil[] =
        JSON.parse(
            fs.readFileSync(
                rutaMatriculas,
                "utf8"
            )
        );


    const matriculasPorCodigo =
        new Map<number, number | null>(
            matriculas.map(item => [
                item.codigo,
                item.matricula
            ])
        );


    let productoresActualizados = 0;
    let productoresSinMatricula = 0;
    let productoresSinCoincidencia = 0;


    const productoresActualizadosJson =
        productores.map(productor => {

            if (!matriculasPorCodigo.has(productor.codigo)) {

                productoresSinCoincidencia++;

                console.warn(
                    `Sin coincidencia: ${productor.codigo} - ${productor.nombre}`
                );

                return {
                    ...productor,
                    matricula: null
                };
            }


            const matricula =
                matriculasPorCodigo.get(
                    productor.codigo
                ) ?? null;


            if (matricula === null) {

                productoresSinMatricula++;

                console.log(
                    `Sin matrícula: ${productor.codigo} - ${productor.nombre}`
                );

            } else {

                productoresActualizados++;
            }


            return {
                ...productor,
                matricula
            };
        });


    fs.writeFileSync(
        rutaProductores,
        JSON.stringify(
            productoresActualizadosJson,
            null,
            4
        ) + "\n",
        "utf8"
    );


    console.log("");
    console.log("==========================================");
    console.log("ACTUALIZACIÓN DE MATRÍCULAS - MERCANTIL");
    console.log("==========================================");

    console.log({
        productoresTotales:
            productores.length,

        productoresActualizados,

        productoresSinMatricula,

        productoresSinCoincidencia
    });

    console.log("");
    console.log(
        "productoresMA.json actualizado correctamente."
    );
}


main()
    .catch((error: unknown) => {

        console.error(
            "Error actualizando productores:",
            error
        );

        process.exitCode = 1;
    });