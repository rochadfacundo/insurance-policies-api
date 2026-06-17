import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { RiesgoMercantil } from "./mercantil/models/riesgoMercantil";



async function main() {

    const archivoJson =
        path.resolve(
            __dirname,
            "mercantil-riesgos.json"
        );

    const contenido =
        fs.readFileSync(
            archivoJson,
            "utf8"
        );

    const riesgos: RiesgoMercantil[] =JSON.parse(contenido);

    const filas = riesgos.map(r => ({
        "Código Productor":
            r.codigoProductor,

        "Productor":
            r.nombreProductor,

        "Tipo":
            r.tipo,

        "Póliza":
            r.poliza,

        "Asegurado":
            r.asegurado,

        "Bien":
            r.bien,

        "Cantidad Bienes":
            r.cantidadBienes,

        "Prima":
            r.prima,

        "Cobertura":
            r.cobertura,
        "Dias para vencer":
            r.diasParaVencer,
        "Desde":
        r.desde,
        "Hasta":
        r.hasta,

    }));

    const workbook =
        XLSX.utils.book_new();

    const worksheet =
        XLSX.utils.json_to_sheet(
            filas
        );

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Riesgos"
    );

    XLSX.writeFile(
        workbook,
        "mercantil-riesgos.xlsx"
    );

    console.log(
        `Excel generado correctamente. Registros: ${riesgos.length}`
    );
}

main();