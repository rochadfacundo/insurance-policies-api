import * as dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestorePASRepository } from "../src/repositories/firestorePASRepository";
import { EstadoCodigoAseguradora } from "../src/models/aseguradora";

// ============================================================
// MODELOS DE AUDITORÍA
// ============================================================

/**
 * Representa una aparición de un código comercial
 * dentro de las vinculaciones de un productor.
 */
interface RegistroCodigo {
    pasId: string;
    nombre: string;
    matricula: string | null;
    aseguradoraId: string;
    codigo: string;
    estado: EstadoCodigoAseguradora;
}

// ============================================================
// AUDITORÍA DE CÓDIGOS COMERCIALES
// ============================================================

/**
 * Audita la integridad de los códigos comerciales registrados
 * en la colección de productores.
 *
 * Detecta:
 *
 * - Códigos repetidos dentro de un mismo PAS.
 * - Códigos asociados a diferentes productores.
 * - Códigos repetidos con estados comerciales contradictorios.
 *
 * La auditoría es exclusivamente de lectura y no realiza
 * modificaciones sobre los documentos de Firestore.
 */
async function main(): Promise<void> {

    const firestore = FirebaseConfig.getFirestore();
    const repository = new FirestorePASRepository(firestore);

    const productores = await repository.obtenerTodos();

    /**
     * Índice global de códigos comerciales.
     *
     * La clave combina aseguradora y código, dado que un mismo
     * número puede existir legítimamente en distintas compañías.
     */
    const indiceCodigos = new Map<string, RegistroCodigo[]>();

    let totalVinculaciones = 0;
    let totalCodigos = 0;

    // ========================================================
    // CONSTRUCCIÓN DEL ÍNDICE
    // ========================================================

    for (const pas of productores) {

        for (const compania of pas.companias) {

            totalVinculaciones++;

            for (const valor of compania.codigos) {

                const codigo = valor.trim();

                totalCodigos++;

                const clave = `${compania.aseguradoraId}:${codigo}`;

                const registros = indiceCodigos.get(clave) ?? [];

                registros.push({
                    pasId: pas.id,
                    nombre: pas.nombre,
                    matricula: pas.matricula,
                    aseguradoraId: compania.aseguradoraId,
                    codigo,
                    estado: compania.estado
                });

                indiceCodigos.set(clave, registros);
            }
        }
    }

    // ========================================================
    // DETECCIÓN DE INCONSISTENCIAS
    // ========================================================

    const duplicadosInternos: RegistroCodigo[] = [];
    const duplicadosEntreProductores: RegistroCodigo[] = [];
    const estadosContradictorios: RegistroCodigo[] = [];

    for (const registros of indiceCodigos.values()) {

        const registrosPorPAS = new Map<string, RegistroCodigo[]>();

        // Agrupa las apariciones del código por productor.
        for (const registro of registros) {

            const encontrados =
                registrosPorPAS.get(registro.pasId) ?? [];

            encontrados.push(registro);

            registrosPorPAS.set(registro.pasId, encontrados);
        }

        // Detecta códigos compartidos por diferentes productores.
        if (registrosPorPAS.size > 1) {

            duplicadosEntreProductores.push(...registros);
        }

        // Detecta inconsistencias dentro de cada productor.
        for (const encontrados of registrosPorPAS.values()) {

            if (encontrados.length > 1) {

                duplicadosInternos.push(...encontrados);
            }

            const estados = new Set(
                encontrados.map(registro => registro.estado)
            );

            if (estados.size > 1) {

                estadosContradictorios.push(...encontrados);
            }
        }
    }

    // ========================================================
    // RESULTADOS
    // ========================================================

    console.log("\n========================================");
    console.log("AUDITORÍA DE CÓDIGOS COMERCIALES PAS");
    console.log("========================================");

    console.table({
        productores: productores.length,
        vinculaciones: totalVinculaciones,
        codigosRegistrados: totalCodigos,
        codigosUnicos: indiceCodigos.size,
        registrosDuplicadosInternos: duplicadosInternos.length,
        registrosDuplicadosEntrePAS: duplicadosEntreProductores.length,
        registrosConEstadosContradictorios: estadosContradictorios.length
    });

    console.log("\nCÓDIGOS DUPLICADOS DENTRO DEL MISMO PAS:");
    console.table(duplicadosInternos);

    console.log("\nCÓDIGOS COMPARTIDOS ENTRE PRODUCTORES:");
    console.table(duplicadosEntreProductores);

    console.log("\nCÓDIGOS CON ESTADOS CONTRADICTORIOS:");
    console.table(estadosContradictorios);

    const existenInconsistencias =
        duplicadosInternos.length > 0 ||
        duplicadosEntreProductores.length > 0 ||
        estadosContradictorios.length > 0;

    console.log(
        existenInconsistencias
            ? "\nSe detectaron inconsistencias que requieren revisión."
            : "\nNo se detectaron inconsistencias."
    );

    console.log("No se realizaron escrituras en Firestore.");

    if (existenInconsistencias) {

        process.exitCode = 1;
    }
}

// ============================================================
// PUNTO DE ENTRADA
// ============================================================

main().catch(error => {

    console.error("Error durante la auditoría de códigos:", error);

    process.exitCode = 1;
});