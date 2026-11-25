import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../../src/config/firebaseConfig";
import { FirestorePASRepository } from "../../src/repositories/firestorePASRepository";
import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";
import { PAS } from "../../src/models/pas";

// ======================================================
// 1. CONFIGURACIÓN
// ======================================================

const ASEGURADORA_ID = "mercantil-andina";

type ResultadoAsociacion =
    | "CODIGO_Y_MATRICULA"
    | "SOLO_CODIGO"
    | "SOLO_MATRICULA"
    | "CONTRADICCION"
    | "CODIGO_DUPLICADO"
    | "MATRICULA_DUPLICADA"
    | "CODIGO_REVISAR"
    | "SIN_COINCIDENCIA";

interface ResultadoAuditoria {
    codigo: number;
    nombre: string;
    matricula: number | null;
    activo: boolean;
    grupoCartera: string;
    resultado: ResultadoAsociacion;
    coincidenciasCodigo: string;
    coincidenciasMatricula: string;
    estadosCodigo: string;
    codigosMercantilRegistrados: string;
}

// ======================================================
// 2. FUNCIONES AUXILIARES
// ======================================================

function describirPAS(productores: PAS[]): string {

    return productores.map(pas =>
        `${pas.nombre} [${pas.id}]`
    ).join(" | ");
}

function clasificar(
    codigo: number,
    matricula: number | null,
    coincidenciasCodigo: PAS[],
    coincidenciasMatricula: PAS[]
): ResultadoAsociacion {

    // Un mismo código pertenece a varios PAS.
    if (coincidenciasCodigo.length > 1) {
        return "CODIGO_DUPLICADO";
    }

    const pasCodigo = coincidenciasCodigo[0];

    // Existe una coincidencia por código.
    if (pasCodigo) {

        // La matrícula registrada es diferente.
        if (
            matricula !== null &&
            pasCodigo.matricula !== null &&
            pasCodigo.matricula.trim() !== "" &&
            pasCodigo.matricula.trim() !== String(matricula)
        ) {
            return "CONTRADICCION";
        }

        // La matrícula apunta también a otro PAS.
        if (
            coincidenciasMatricula.some(
                pas => pas.id !== pasCodigo.id
            )
        ) {
            return "CONTRADICCION";
        }

        const registrosCodigo = pasCodigo.companias.filter(
            compania =>
                compania.aseguradoraId === ASEGURADORA_ID &&
                compania.codigos.some(
                    c => c.trim() === String(codigo)
                )
        );

        // Estados que todavía requieren revisión comercial.
        if (
            registrosCodigo.some(
                compania => compania.estado !== "PROPIO"
            )
        ) {
            return "CODIGO_REVISAR";
        }

        if (
            coincidenciasMatricula.some(
                pas => pas.id === pasCodigo.id
            )
        ) {
            return "CODIGO_Y_MATRICULA";
        }

        return "SOLO_CODIGO";
    }

    // No existe coincidencia por código.
    if (coincidenciasMatricula.length > 1) {
        return "MATRICULA_DUPLICADA";
    }

    if (coincidenciasMatricula.length === 1) {
        return "SOLO_MATRICULA";
    }

    return "SIN_COINCIDENCIA";
}

function escaparCSV(valor: unknown): string {

    let texto = String(valor ?? "");

    // Evita interpretar contenido como fórmulas en Excel.
    if (/^[=+\-@\t\r]/.test(texto)) {
        texto = "'" + texto;
    }

    return `"${texto.replace(/"/g, '""')}"`;
}

// ======================================================
// 3. PROCESO PRINCIPAL
// ======================================================

async function main(): Promise<void> {

    const inicio = Date.now();

    const firestore = FirebaseConfig.getFirestore();

    const repository = new FirestorePASRepository(firestore);

    const productoresPAS = await repository.obtenerTodos();

    const productoresMercantil = obtenerProductoresMercantil();

    const resultados: ResultadoAuditoria[] = [];

    console.log("\n======================================");
    console.log("AUDITORÍA GENERAL MERCANTIL - PAS");
    console.log("======================================");

    console.log(`PAS en Firestore: ${productoresPAS.length}`);
    console.log(`Registros Mercantil: ${productoresMercantil.length}`);

    // ==================================================
    // 4. AUDITORÍA DE CADA PRODUCTOR
    // ==================================================

    for (const productor of productoresMercantil) {

        const coincidenciasCodigo = productoresPAS.filter(
            pas => pas.companias.some(
                compania =>
                    compania.aseguradoraId === ASEGURADORA_ID &&
                    compania.codigos.some(
                        codigo =>
                            codigo.trim() === String(productor.codigo)
                    )
            )
        );

        const coincidenciasMatricula =
            productor.matricula !== null
                ? productoresPAS.filter(
                    pas =>
                        pas.matricula?.trim() ===
                        String(productor.matricula)
                )
                : [];

        const resultado = clasificar(
            productor.codigo,
            productor.matricula,
            coincidenciasCodigo,
            coincidenciasMatricula
        );

        const candidatos = [
            ...new Map(
                [
                    ...coincidenciasCodigo,
                    ...coincidenciasMatricula
                ].map(pas => [pas.id, pas])
            ).values()
        ];

        const registrosMercantil = candidatos.flatMap(
            pas => pas.companias.filter(
                compania =>
                    compania.aseguradoraId === ASEGURADORA_ID
            )
        );

        resultados.push({
            codigo: productor.codigo,
            nombre: productor.nombre,
            matricula: productor.matricula,
            activo: productor.estado_id === 1,
            grupoCartera: productor.grupoCartera ?? "",
            resultado,
            coincidenciasCodigo: describirPAS(coincidenciasCodigo),
            coincidenciasMatricula: describirPAS(coincidenciasMatricula),
            estadosCodigo: registrosMercantil.map(
                compania => compania.estado
            ).join(" | "),
            codigosMercantilRegistrados: registrosMercantil.flatMap(
                compania => compania.codigos
            ).join(" | ")
        });
    }

    // ==================================================
    // 5. RESUMEN GENERAL
    // ==================================================

    const categorias: ResultadoAsociacion[] = [
        "CODIGO_Y_MATRICULA",
        "SOLO_CODIGO",
        "SOLO_MATRICULA",
        "CONTRADICCION",
        "CODIGO_DUPLICADO",
        "MATRICULA_DUPLICADA",
        "CODIGO_REVISAR",
        "SIN_COINCIDENCIA"
    ];

    const resumen = categorias.map(categoria => {

        const registros = resultados.filter(
            resultado => resultado.resultado === categoria
        );

        return {
            resultado: categoria,
            total: registros.length,
            activos: registros.filter(r => r.activo).length,
            inactivos: registros.filter(r => !r.activo).length
        };
    });

    console.log("\n======================================");
    console.log("RESULTADO GENERAL");
    console.log("======================================");

    console.table(resumen);

    const activos = resultados.filter(r => r.activo);

    const asociacionesSeguras = activos.filter(
        r =>
            r.resultado === "CODIGO_Y_MATRICULA" ||
            r.resultado === "SOLO_CODIGO"
    );

    const asociacionesPorMatricula = activos.filter(
        r => r.resultado === "SOLO_MATRICULA"
    );

    const pendientes = resultados.filter(
        r =>
            r.resultado !== "CODIGO_Y_MATRICULA" &&
            r.resultado !== "SOLO_CODIGO"
    );

    const pendientesActivos = pendientes.filter(r => r.activo);

    const porcentajeAsociado = activos.length > 0
        ? (
            asociacionesSeguras.length /
            activos.length * 100
        ).toFixed(2)
        : "0.00";

    console.log("\nRESUMEN DE PRODUCTORES:");

    console.log({
        registrosTotales: resultados.length,
        activos: activos.length,
        inactivos: resultados.length - activos.length,
        activosConAsociacionSegura: asociacionesSeguras.length,
        activosSoloMatricula: asociacionesPorMatricula.length,
        activosPendientesRevision: pendientesActivos.length,
        porcentajeAsociacionSegura: `${porcentajeAsociado}%`
    });

    // ==================================================
    // 6. DETALLE DE ACTIVOS PENDIENTES
    // ==================================================

    console.log("\nPRODUCTORES ACTIVOS PENDIENTES:");

    console.table(
        pendientesActivos.map(r => ({
            codigo: r.codigo,
            nombre: r.nombre,
            matricula: r.matricula,
            grupoCartera: r.grupoCartera,
            resultado: r.resultado
        }))
    );

    // ==================================================
    // 7. EXPORTACIÓN CSV
    // ==================================================

    const columnas: (keyof ResultadoAuditoria)[] = [
        "codigo",
        "nombre",
        "matricula",
        "activo",
        "grupoCartera",
        "resultado",
        "coincidenciasCodigo",
        "coincidenciasMatricula",
        "estadosCodigo",
        "codigosMercantilRegistrados"
    ];

    function generarCSV(
        nombreArchivo: string,
        registros: ResultadoAuditoria[]
    ): void {

        const ruta = path.resolve(__dirname, nombreArchivo);

        const encabezado = columnas.join(";");

        const filas = registros.map(registro =>
            columnas.map(
                columna => escaparCSV(registro[columna])
            ).join(";")
        );

        const contenido = [
            encabezado,
            ...filas
        ].join("\n");

        fs.writeFileSync(
            ruta,
            "\uFEFF" + contenido,
            "utf8"
        );

        console.log(`CSV generado: ${ruta}`);
    }

    console.log("\nARCHIVOS GENERADOS:");

    generarCSV(
        "auditoria-asociacion-mercantil.csv",
        resultados
    );

    generarCSV(
        "auditoria-mercantil-pendientes.csv",
        pendientes
    );

    generarCSV(
        "auditoria-mercantil-pendientes-activos.csv",
        pendientesActivos
    );

    console.log("\n======================================");

    console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("No se realizaron escrituras en Firestore.");
    console.log("No se realizaron consultas a la API de Mercantil.");
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});