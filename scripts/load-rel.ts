import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";


interface ProductorCatalogo {
    codigo: number;
    nombre: string;
    estado_id?: number;
    matricula: number | null;
    grupoCartera?: string;
}


interface PasDetalle {
    fila: number;
    nombre: string;
    matricula: number | null;
    mercantil: string;
    rus: string;
    ejecutiva: string;
}


interface Coincidencia {
    compania: "MERCANTIL" | "RUS";
    productorCatalogo: ProductorCatalogo;
    pas: PasDetalle;
    valorExcel: string;
    tipoCoincidencia:
        | "CODIGO_EXACTO"
        | "CODIGO_DENTRO_DE_TEXTO";
}


/*
 * ============================================================
 * UTILIDADES
 * ============================================================
 */

function obtenerTexto(
    valor: ExcelJS.CellValue
): string {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }


    if (typeof valor === "object") {

        if (
            "text" in valor &&
            typeof valor.text === "string"
        ) {
            return valor.text.trim();
        }


        if ("result" in valor) {

            return String(
                valor.result ?? ""
            ).trim();
        }
    }


    return String(valor).trim();
}


function normalizarMatricula(
    valor: ExcelJS.CellValue
): number | null {

    const texto =
        obtenerTexto(valor)
            .trim()
            .replace(/\./g, "")
            .replace(/,/g, "");


    if (!/^\d+$/.test(texto)) {
        return null;
    }


    const numero =
        Number(texto);


    return Number.isFinite(numero)
        ? numero
        : null;
}


/*
 * Extrae TODOS los bloques numéricos de una celda.
 *
 * Ejemplos:
 *
 * "6733"               -> [6733]
 * "SUB 15352"          -> [15352]
 * "12214-16592"        -> [12214, 16592]
 * "SUB99367/ 17236"    -> [99367, 17236]
 * "Otro Org"           -> []
 *
 * Esto es solamente para DIAGNÓSTICO.
 * No estamos diciendo que todos esos números
 * sean necesariamente códigos válidos.
 */
function extraerNumeros(
    valor: string
): number[] {

    const coincidencias =
        valor.match(/\d+/g);


    if (!coincidencias) {
        return [];
    }


    return coincidencias
        .map(Number)
        .filter(Number.isFinite);
}


function esCodigoExacto(
    valor: string,
    codigo: number
): boolean {

    const texto =
        valor
            .trim()
            .replace(/\./g, "");


    return (
        /^\d+$/.test(texto) &&
        Number(texto) === codigo
    );
}


function cargarCatalogo(
    ruta: string
): ProductorCatalogo[] {

    return JSON.parse(
        fs.readFileSync(
            ruta,
            "utf8"
        )
    ) as ProductorCatalogo[];
}


/*
 * ============================================================
 * BUSCAR COINCIDENCIAS
 * ============================================================
 */

function buscarCoincidencias(
    compania: "MERCANTIL" | "RUS",
    productoresSinMatricula: ProductorCatalogo[],
    filas: PasDetalle[]
): Coincidencia[] {

    const resultado:
        Coincidencia[] = [];


    for (
        const productor
        of productoresSinMatricula
    ) {

        for (
            const pas
            of filas
        ) {

            const valorExcel =
                compania === "MERCANTIL"
                    ? pas.mercantil
                    : pas.rus;


            if (!valorExcel) {
                continue;
            }


            const numeros =
                extraerNumeros(
                    valorExcel
                );


            if (
                !numeros.includes(
                    productor.codigo
                )
            ) {
                continue;
            }


            resultado.push({

                compania,

                productorCatalogo:
                    productor,

                pas,

                valorExcel,

                tipoCoincidencia:
                    esCodigoExacto(
                        valorExcel,
                        productor.codigo
                    )
                        ? "CODIGO_EXACTO"
                        : "CODIGO_DENTRO_DE_TEXTO"
            });
        }
    }


    return resultado;
}


/*
 * ============================================================
 * MOSTRAR COINCIDENCIA
 * ============================================================
 */

function imprimirCoincidencia(
    coincidencia: Coincidencia
): void {

    console.log("");
    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        `${coincidencia.compania} | ` +
        `Código ${coincidencia.productorCatalogo.codigo}`
    );

    console.log(
        "------------------------------------------------------------"
    );


    console.log(
        `Catálogo:       ${coincidencia.productorCatalogo.nombre}`
    );

    console.log(
        `Matrícula cat.: ${
            coincidencia.productorCatalogo.matricula ?? "-"
        }`
    );

    console.log(
        `Estado ID:      ${
            coincidencia.productorCatalogo.estado_id ?? "-"
        }`
    );

    console.log(
        `Grupo cartera:  ${
            coincidencia.productorCatalogo.grupoCartera ?? "-"
        }`
    );


    console.log("");

    console.log(
        `Fila Excel:     ${coincidencia.pas.fila}`
    );

    console.log(
        `PAS Excel:      ${coincidencia.pas.nombre}`
    );

    console.log(
        `Matrícula PAS:  ${
            coincidencia.pas.matricula ?? "-"
        }`
    );

    console.log(
        `Ejecutiva:      ${
            coincidencia.pas.ejecutiva || "-"
        }`
    );

    console.log(
        `Celda Excel:    "${coincidencia.valorExcel}"`
    );

    console.log(
        `Coincidencia:   ${coincidencia.tipoCoincidencia}`
    );
}


/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main(): Promise<void> {

    const rutaExcel =
        path.join(
            __dirname,
            "data",
            "detalle.xlsx"
        );


    const rutaMA =
        path.join(
            __dirname,
            "data",
            "productoresMA.json"
        );


    const rutaRUS =
        path.join(
            __dirname,
            "data",
            "productoresRus-matricula.json"
        );


    /*
     * ========================================================
     * 1. CATÁLOGOS
     * ========================================================
     */

    const productoresMA =
        cargarCatalogo(
            rutaMA
        );


    const productoresRUS =
        cargarCatalogo(
            rutaRUS
        );


    /*
     * Solamente nos interesan los productores/cuentas
     * que el catálogo NO puede vincular mediante matrícula.
     */
    const maSinMatricula =
        productoresMA.filter(
            productor =>
                productor.matricula === null
        );


    const rusSinMatricula =
        productoresRUS.filter(
            productor =>
                productor.matricula === null
        );


    /*
     * ========================================================
     * 2. EXCEL - HOJA 2
     * ========================================================
     */

    const workbook =
        new ExcelJS.Workbook();


    await workbook.xlsx.readFile(
        rutaExcel
    );


    const worksheet =
        workbook.worksheets[1];


    if (!worksheet) {

        throw new Error(
            "No se encontró la hoja 2 de detalle.xlsx."
        );
    }


    const filas:
        PasDetalle[] = [];


    for (
        let numeroFila = 2;
        numeroFila <= worksheet.rowCount;
        numeroFila++
    ) {

        const fila =
            worksheet.getRow(
                numeroFila
            );


        const nombre =
            obtenerTexto(
                fila.getCell(1).value
            );


        if (!nombre) {
            continue;
        }


        filas.push({

            fila:
                numeroFila,

            nombre,

            matricula:
                normalizarMatricula(
                    fila.getCell(2).value
                ),

            mercantil:
                obtenerTexto(
                    fila.getCell(3).value
                ),

            rus:
                obtenerTexto(
                    fila.getCell(4).value
                ),

            ejecutiva:
                obtenerTexto(
                    fila.getCell(8).value
                )
        });
    }


    /*
     * ========================================================
     * 3. INFORMACIÓN GENERAL
     * ========================================================
     */

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "CÓDIGOS SIN MATRÍCULA EN LOS CATÁLOGOS"
    );

    console.log(
        "============================================================"
    );


    console.log(
        `Mercantil: ${maSinMatricula.length}`
    );

    console.log(
        `RUS:       ${rusSinMatricula.length}`
    );


    /*
     * ========================================================
     * 4. CRUZAMOS CONTRA detalle.xlsx
     * ========================================================
     */

    const coincidenciasMA =
        buscarCoincidencias(
            "MERCANTIL",
            maSinMatricula,
            filas
        );


    const coincidenciasRUS =
        buscarCoincidencias(
            "RUS",
            rusSinMatricula,
            filas
        );


    const coincidencias = [
        ...coincidenciasMA,
        ...coincidenciasRUS
    ];


    /*
     * ========================================================
     * 5. MOSTRAMOS LAS COINCIDENCIAS
     * ========================================================
     */

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "CÓDIGOS SIN MATRÍCULA QUE APARECEN EN detalle.xlsx"
    );

    console.log(
        "============================================================"
    );


    if (
        coincidencias.length === 0
    ) {

        console.log("");
        console.log(
            "No se encontraron coincidencias."
        );

    } else {

        for (
            const coincidencia
            of coincidencias
        ) {

            imprimirCoincidencia(
                coincidencia
            );
        }
    }


    /*
     * ========================================================
     * 6. SEPARAMOS EXACTOS DE TEXTUALES
     * ========================================================
     */

    const exactos =
        coincidencias.filter(
            coincidencia =>
                coincidencia.tipoCoincidencia ===
                "CODIGO_EXACTO"
        );


    const dentroTexto =
        coincidencias.filter(
            coincidencia =>
                coincidencia.tipoCoincidencia ===
                "CODIGO_DENTRO_DE_TEXTO"
        );


    /*
     * ========================================================
     * 7. CÓDIGOS SIN MATRÍCULA QUE NO PUDIMOS EXPLICAR
     * ========================================================
     */

    const codigosEncontradosMA =
        new Set(
            coincidenciasMA.map(
                coincidencia =>
                    coincidencia
                        .productorCatalogo
                        .codigo
            )
        );


    const codigosEncontradosRUS =
        new Set(
            coincidenciasRUS.map(
                coincidencia =>
                    coincidencia
                        .productorCatalogo
                        .codigo
            )
        );


    const maNoEncontrados =
        maSinMatricula.filter(
            productor =>
                !codigosEncontradosMA.has(
                    productor.codigo
                )
        );


    const rusNoEncontrados =
        rusSinMatricula.filter(
            productor =>
                !codigosEncontradosRUS.has(
                    productor.codigo
                )
        );


    /*
     * ========================================================
     * 8. RESUMEN MUY IMPORTANTE
     * ========================================================
     */

    console.log("");
    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "RESUMEN"
    );

    console.log(
        "============================================================"
    );


    console.log("");
    console.log("MERCANTIL");
    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        `Catálogo sin matrícula:          ${maSinMatricula.length}`
    );

    console.log(
        `Encontrados en detalle.xlsx:     ${codigosEncontradosMA.size}`
    );

    console.log(
        `No encontrados en detalle.xlsx:  ${maNoEncontrados.length}`
    );


    console.log("");
    console.log("RUS");
    console.log(
        "------------------------------------------------------------"
    );

    console.log(
        `Catálogo sin matrícula:          ${rusSinMatricula.length}`
    );

    console.log(
        `Encontrados en detalle.xlsx:     ${codigosEncontradosRUS.size}`
    );

    console.log(
        `No encontrados en detalle.xlsx:  ${rusNoEncontrados.length}`
    );


    console.log("");
    console.log(
        `Coincidencias exactas:           ${exactos.length}`
    );

    console.log(
        `Coincidencias dentro de texto:   ${dentroTexto.length}`
    );


    /*
     * ========================================================
     * 9. RESUMEN PARA TOMAR DECISIONES
     * ========================================================
     */

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "POSIBLES RELACIONES FALTANTES"
    );

    console.log(
        "============================================================"
    );


    for (
        const coincidencia
        of coincidencias
    ) {

        console.log("");

        console.log(
            `${coincidencia.compania}_` +
            `${coincidencia.productorCatalogo.codigo}`
        );

        console.log(
            `  Catálogo:   ${
                coincidencia.productorCatalogo.nombre
            }`
        );

        console.log(
            `  Excel PAS:  ${
                coincidencia.pas.nombre
            }`
        );

        console.log(
            `  Matrícula:  ${
                coincidencia.pas.matricula ?? "-"
            }`
        );

        console.log(
            `  Ejecutiva:  ${
                coincidencia.pas.ejecutiva || "-"
            }`
        );

        console.log(
            `  Celda:      "${
                coincidencia.valorExcel
            }"`
        );

        console.log(
            `  Tipo:       ${
                coincidencia.tipoCoincidencia
            }`
        );
    }


    /*
     * ========================================================
     * 10. LOS QUE QUEDAN SIN EXPLICACIÓN
     * ========================================================
     */

    console.log("");
    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "SIN MATRÍCULA Y SIN REFERENCIA EN detalle.xlsx"
    );

    console.log(
        "============================================================"
    );


    console.log("");
    console.log("MERCANTIL");
    console.log(
        "------------------------------------------------------------"
    );


    for (
        const productor
        of maNoEncontrados
    ) {

        console.log(
            `${productor.codigo} | ` +
            `${productor.nombre} | ` +
            `${productor.grupoCartera ?? "-"}`
        );
    }


    console.log("");
    console.log("RUS");
    console.log(
        "------------------------------------------------------------"
    );


    for (
        const productor
        of rusNoEncontrados
    ) {

        console.log(
            `${productor.codigo} | ` +
            `${productor.nombre} | ` +
            `${productor.grupoCartera ?? "-"}`
        );
    }


    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "Este script NO realizó escrituras en Firebase."
    );

    console.log(
        "============================================================"
    );
}


main()
    .then(() => {

        console.log("");
        console.log(
            "Diagnóstico finalizado correctamente."
        );

        process.exit(0);
    })
    .catch(error => {

        console.error("");
        console.error(
            "❌ Error ejecutando diagnóstico:"
        );

        console.error(error);

        process.exit(1);
    });