
import * as ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

import { PAS } from "../src/models/pas";
import { CodigoAseguradora } from "../src/models/aseguradora";

// ========================================
// CONFIGURACIÓN
// ========================================

const ARCHIVO = path.resolve(
    __dirname,
    "data/AGENDA GENERAL PAS.xlsx"
);

const HOJA = "PRODUCTORES";

const SALIDA = path.resolve(
    __dirname,
    "resultado-importacion-pas.json"
);

// ========================================
// COLUMNAS DEL EXCEL
// ========================================

const COLUMNAS = {
    NOMBRE: 1,
    MATRICULA: 2,
    RC: 3,

    EJECUTIVO: 16,
    VINCULO: 17,
    ESTADO: 18,
    ACTIVIDAD: 19,

    CUMPLEANIOS: 20,
    TELEFONO: 21,
    TELEFONO_ALTERNATIVO: 22,
    EMAIL: 23,
    EMAIL_ALTERNATIVO: 24,

    DOMICILIO_PARTICULAR: 25,
    DOMICILIO_COMERCIAL: 26,
    PARTICULARIDADES: 27,
    OTRAS_COMPANIAS: 28,
    REDES_SOCIALES: 29
} as const;

// IDs que utilizaremos en la colección aseguradoras.
// Deben coincidir con los que importemos posteriormente.

const COLUMNAS_ASEGURADORAS = [
    { columna: 4, id: "mercantil-andina" },
    { columna: 5, id: "rio-uruguay" },
    { columna: 6, id: "federacion-patronal" },
    { columna: 7, id: "rivadavia" },
    { columna: 8, id: "barbus" },
    { columna: 9, id: "atm" },
    { columna: 10, id: "life" },
    { columna: 11, id: "smg-life" },
    { columna: 12, id: "digna" },
    { columna: 13, id: "evolucion" },
    { columna: 14, id: "zona-art" },
    { columna: 15, id: "nacion" }
] as const;

// ========================================
// INTERFACES DEL REPORTE
// ========================================

interface RegistroSimulado {
    fila: number;
    pas: PAS;
    ejecutivoExcel: string | null;
    rcOriginal: string | null;
    codigosOriginales: Record<string, string>;
    advertencias: string[];
}

interface MatriculaDuplicada {
    matricula: string;
    filas: number[];
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Convierte el valor de una celda a texto.
 */
function texto(valor: ExcelJS.CellValue): string | null {

    if (valor === null || valor === undefined) {
        return null;
    }

    if (valor instanceof Date) {
        return valor.toISOString().slice(0, 10);
    }

    if (typeof valor === "object") {

        if ("text" in valor && typeof valor.text === "string") {
            return valor.text.trim() || null;
        }

        if ("result" in valor) {
            return texto(valor.result as ExcelJS.CellValue);
        }

        if ("richText" in valor && Array.isArray(valor.richText)) {
            const contenido = valor.richText
                .map(fragmento => fragmento.text)
                .join("")
                .trim();

            return contenido || null;
        }

        return null;
    }

    const resultado = String(valor).trim();

    return resultado || null;
}

/**
 * Obtiene el texto de una columna.
 */
function obtenerTexto(
    fila: ExcelJS.Row,
    columna: number
): string | null {

    return texto(fila.getCell(columna).value);
}

/**
 * Normaliza la matrícula.
 * Solamente acepta valores numéricos.
 */
function normalizarMatricula(
    valor: string | null
): string | null {

    if (!valor) {
        return null;
    }

    const normalizado = valor.replace(/\s/g, "");

    return /^\d+$/.test(normalizado)
        ? normalizado
        : null;
}

/**
 * Convierte el estado RC a boolean.
 */
function normalizarRC(
    valor: string | null
): boolean | null {

    if (!valor) {
        return null;
    }

    const normalizado = valor.trim().toUpperCase();

    if (normalizado === "SI" || normalizado === "SÍ") {
        return true;
    }

    if (normalizado === "NO") {
        return false;
    }

    return null;
}

/**
 * Convierte una fecha de Excel a YYYY-MM-DD.
 */
function normalizarFecha(
    valor: ExcelJS.CellValue
): string | null {

    if (valor instanceof Date) {
        return valor.toISOString().slice(0, 10);
    }

    if (typeof valor === "number") {

        const fecha = new Date(
            Math.round((valor - 25569) * 86400 * 1000)
        );

        return !isNaN(fecha.getTime())
            ? fecha.toISOString().slice(0, 10)
            : null;
    }

    return texto(valor);
}

/**
 * Procesa códigos de productor.
 *
 * Se aceptan:
 * 12345
 * 12345,67890
 * 12345;67890
 *
 * Los valores ambiguos se registran
 * como advertencias.
 */
function procesarCodigos(
    valor: string | null,
    aseguradoraId: string,
    advertencias: string[]
): string[] {

    if (!valor) {
        return [];
    }

    if (/^\d+$/.test(valor)) {
        return [valor];
    }

    if (/^\d+(?:\s*[,;]\s*\d+)+$/.test(valor)) {

        return valor
            .split(/[,;]/)
            .map(codigo => codigo.trim());
    }

    advertencias.push(
        `Código ambiguo en ${aseguradoraId}: "${valor}"`
    );

    return [];
}

// ========================================
// TRANSFORMACIÓN DE FILAS
// ========================================

function transformarFila(
    fila: ExcelJS.Row
): RegistroSimulado | null {

    const nombre = obtenerTexto(
        fila,
        COLUMNAS.NOMBRE
    );

    if (!nombre) {
        return null;
    }

    const advertencias: string[] = [];

    // Matrícula
    const matriculaOriginal = obtenerTexto(
        fila,
        COLUMNAS.MATRICULA
    );

    const matricula = normalizarMatricula(
        matriculaOriginal
    );

    if (!matricula) {
        advertencias.push(
            `Matrícula ausente o inválida: "${matriculaOriginal ?? "vacía"}"`
        );
    }

    // RC
    const rcOriginal = obtenerTexto(
        fila,
        COLUMNAS.RC
    );

    const tieneRC = normalizarRC(rcOriginal);

    if (rcOriginal && tieneRC === null) {
        advertencias.push(
            `RC no reconocido: "${rcOriginal}"`
        );
    }

    // Aseguradoras
    const companias: CodigoAseguradora[] = [];

    const codigosOriginales: Record<string, string> = {};

    for (const configuracion of COLUMNAS_ASEGURADORAS) {

        const valor = obtenerTexto(
            fila,
            configuracion.columna
        );

        if (!valor) {
            continue;
        }

        codigosOriginales[configuracion.id] = valor;

        const codigos = procesarCodigos(
            valor,
            configuracion.id,
            advertencias
        );

        if (codigos.length > 0) {

            companias.push({
                aseguradoraId: configuracion.id,
                codigos
            });
        }
    }

    // Clasificación comercial
    const clasificacion = obtenerTexto(
        fila,
        COLUMNAS.ESTADO
    )?.toUpperCase() ?? null;

    // Ejecutiva
    const ejecutivoExcel = obtenerTexto(
        fila,
        COLUMNAS.EJECUTIVO
    );

    // Otras aseguradoras
    const otrasCompanias = obtenerTexto(
        fila,
        COLUMNAS.OTRAS_COMPANIAS
    );

    // Construcción del PAS
    const pas: PAS = {

        // Firestore asignará el ID posteriormente.
        id: "",

        nombre,
        matricula,

        estado: clasificacion === "BAJA"
            ? "BAJA"
            : "PENDIENTE",

        clasificacion,

        vinculo: obtenerTexto(
            fila,
            COLUMNAS.VINCULO
        ),

        actividadPrincipal: obtenerTexto(
            fila,
            COLUMNAS.ACTIVIDAD
        ),

        tieneRC,

        // Se asociará con Firestore posteriormente.
        ejecutivaId: null,

        contacto: {

            telefono: obtenerTexto(
                fila,
                COLUMNAS.TELEFONO
            ),

            telefonoAlternativo: obtenerTexto(
                fila,
                COLUMNAS.TELEFONO_ALTERNATIVO
            ),

            email: obtenerTexto(
                fila,
                COLUMNAS.EMAIL
            ),

            emailAlternativo: obtenerTexto(
                fila,
                COLUMNAS.EMAIL_ALTERNATIVO
            ),

            fechaNacimiento: normalizarFecha(
                fila.getCell(COLUMNAS.CUMPLEANIOS).value
            ),

            domicilioParticular: obtenerTexto(
                fila,
                COLUMNAS.DOMICILIO_PARTICULAR
            ),

            domicilioComercial: obtenerTexto(
                fila,
                COLUMNAS.DOMICILIO_COMERCIAL
            ),

            redesSociales: obtenerTexto(
                fila,
                COLUMNAS.REDES_SOCIALES
            )
        },

        companias,

        otrasCompanias: otrasCompanias
            ? [otrasCompanias]
            : [],

        particularidades: obtenerTexto(
            fila,
            COLUMNAS.PARTICULARIDADES
        ),

        productorSuperiorId: null,

        origen: "EXCEL",
        filaOrigen: fila.number
    };

    return {
        fila: fila.number,
        pas,
        ejecutivoExcel,
        rcOriginal,
        codigosOriginales,
        advertencias
    };
}

// ========================================
// PROCESO PRINCIPAL
// ========================================

async function main(): Promise<void> {

    const inicio = Date.now();

    console.log("");
    console.log("========================================");
    console.log("IMPORTACIÓN PAS - MODO SIMULACIÓN");
    console.log("========================================");

    console.log(`Archivo: ${ARCHIVO}`);
    console.log(`Hoja: ${HOJA}`);

    if (!fs.existsSync(ARCHIVO)) {
        throw new Error(
            `No se encontró el archivo Excel: ${ARCHIVO}`
        );
    }

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.readFile(ARCHIVO);

    const hoja = workbook.getWorksheet(HOJA);

    if (!hoja) {
        throw new Error(
            `No existe la hoja "${HOJA}" en el Excel.`
        );
    }

    const registros: RegistroSimulado[] = [];

    hoja.eachRow((fila, numeroFila) => {

        // Saltamos encabezados.
        if (numeroFila === 1) {
            return;
        }

        const registro = transformarFila(fila);

        if (registro) {
            registros.push(registro);
        }
    });

    // ========================================
    // DETECCIÓN DE MATRÍCULAS DUPLICADAS
    // ========================================

    const matriculas = new Map<string, number[]>();

    for (const registro of registros) {

        const matricula = registro.pas.matricula;

        if (!matricula) {
            continue;
        }

        const filas = matriculas.get(matricula) ?? [];

        filas.push(registro.fila);

        matriculas.set(matricula, filas);
    }

    const duplicadas: MatriculaDuplicada[] =
        Array.from(matriculas.entries())
            .filter(([, filas]) => filas.length > 1)
            .map(([matricula, filas]) => ({
                matricula,
                filas
            }));

    for (const duplicada of duplicadas) {

        for (const fila of duplicada.filas) {

            const registro = registros.find(
                r => r.fila === fila
            );

            if (registro) {
                registro.advertencias.push(
                    `Matrícula duplicada: ${duplicada.matricula}`
                );
            }
        }
    }

    // ========================================
    // RESUMEN
    // ========================================

    const resumen = {

        totalPAS: registros.length,

        conMatricula: registros.filter(
            r => r.pas.matricula !== null
        ).length,

        sinMatricula: registros.filter(
            r => r.pas.matricula === null
        ).length,

        matriculasDuplicadas: duplicadas,

        conAdvertencias: registros.filter(
            r => r.advertencias.length > 0
        ).length,

        sinEjecutivo: registros.filter(
            r => !r.ejecutivoExcel
        ).length,

        cantidadCodigos: registros.reduce(
            (total, registro) =>
                total + registro.pas.companias.reduce(
                    (subtotal, compania) =>
                        subtotal + compania.codigos.length,
                    0
                ),
            0
        )
    };

    // ========================================
    // GENERACIÓN DEL REPORTE
    // ========================================

    const reporte = {
        modo: "DRY_RUN",
        archivo: path.basename(ARCHIVO),
        hoja: HOJA,
        fecha: new Date().toISOString(),
        resumen,
        registros
    };

    fs.writeFileSync(
        SALIDA,
        JSON.stringify(reporte, null, 2),
        "utf8"
    );

    // ========================================
    // RESULTADOS EN CONSOLA
    // ========================================

    console.log("");
    console.log("========================================");
    console.log("RESUMEN DE IMPORTACIÓN");
    console.log("========================================");

    console.table({
        totalPAS: resumen.totalPAS,
        conMatricula: resumen.conMatricula,
        sinMatricula: resumen.sinMatricula,
        matriculasDuplicadas: duplicadas.length,
        conAdvertencias: resumen.conAdvertencias,
        sinEjecutivo: resumen.sinEjecutivo,
        cantidadCodigos: resumen.cantidadCodigos
    });

    console.log("");
    console.log("MATRÍCULAS DUPLICADAS:");
    console.table(duplicadas);

    console.log("");
    console.log(`Reporte generado: ${SALIDA}`);

    console.log("");
    console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("");
    console.log("No se realizaron escrituras en Firestore.");
    console.log("Simulación finalizada.");
}

// ========================================
// EJECUCIÓN
// ========================================

main().catch((error: unknown) => {

    console.error("");
    console.error("Error durante la simulación:", error);

    process.exitCode = 1;
});
