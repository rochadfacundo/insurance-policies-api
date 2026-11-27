import * as dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestorePASRepository } from "../src/repositories/firestorePASRepository";
import { FirestoreEjecutivaRepository } from "../src/repositories/firestoreEjecutivaRepository";
import { PAS, TipoGestionPAS } from "../src/models/pas";
import { esPASValido } from "../src/validators/pasValidator";

function tieneRelacionCircular(
    pas: PAS,
    productores: Map<string, PAS>
): boolean {

    const visitados = new Set<string>();

    let actual: PAS | undefined = pas;

    while (actual) {

        if (visitados.has(actual.id)) {
            return true;
        }

        visitados.add(actual.id);

        if (!actual.productorSuperiorId) {
            return false;
        }

        actual = productores.get(actual.productorSuperiorId);
    }

    return false;
}

async function main(): Promise<void> {

    console.log("========================================");
    console.log("AUDITORÍA GENERAL DE GESTIÓN PAS");
    console.log("MODO SOLO LECTURA");
    console.log("========================================");

    const firestore = FirebaseConfig.getFirestore();

    const pasRepository = new FirestorePASRepository(firestore);
    const ejecutivaRepository = new FirestoreEjecutivaRepository();

    const [productores, ejecutivas] = await Promise.all([
        pasRepository.obtenerTodos(),
        ejecutivaRepository.obtenerTodas()
    ]);

    const productoresPorId = new Map(
        productores.map(pas => [pas.id, pas])
    );

    const ejecutivasPorId = new Map(
        ejecutivas.map(ejecutiva => [ejecutiva.id, ejecutiva])
    );

    const errores: string[] = [];
    const advertencias: string[] = [];

    const distribucion: Record<TipoGestionPAS, number> = {
        EJECUTIVA_ASIGNADA: 0,
        GESTIONADO_POR_ORGANIZADOR: 0,
        AUTOGESTIONADO: 0,
        SIN_ASIGNAR: 0
    };

    const porEjecutiva: Record<string, number> = {};
    const porOrganizador: Record<string, number> = {};

    for (const pas of productores) {

        const id = pas.id;
        const nombre = pas.nombre;

        if (!esPASValido(pas)) {

            errores.push(
                `Estructura inválida: ${id} - ${nombre}`
            );

            continue;
        }

        const tipoGestion = pas.tipoGestion;

        if (!tipoGestion) {

            errores.push(
                `Tipo de gestión ausente: ${id}`
            );

            continue;
        }

        distribucion[tipoGestion]++;

        // Validación de ejecutiva directa.

        if (tipoGestion === "EJECUTIVA_ASIGNADA") {

            if (!pas.ejecutivaId) {

                errores.push(
                    `Ejecutiva ausente: ${id}`
                );

            } else {

                const ejecutiva = ejecutivasPorId.get(
                    pas.ejecutivaId
                );

                if (!ejecutiva) {

                    errores.push(
                        `Ejecutiva inexistente: ${id}`
                    );

                } else {

                    if (!ejecutiva.activa) {

                        advertencias.push(
                            `Ejecutiva inactiva: ${id}`
                        );
                    }

                    porEjecutiva[ejecutiva.id] =
                        (porEjecutiva[ejecutiva.id] ?? 0) + 1;
                }
            }

        } else if (pas.ejecutivaId !== null) {

            errores.push(
                `Ejecutiva incompatible con tipo de gestión: ${id}`
            );
        }

        // Validación de relaciones organizativas.

        if (
            tipoGestion === "GESTIONADO_POR_ORGANIZADOR" &&
            !pas.productorSuperiorId
        ) {

            errores.push(
                `Organizador ausente: ${id}`
            );
        }

        if (pas.productorSuperiorId) {

            const superior = productoresPorId.get(
                pas.productorSuperiorId
            );

            if (!superior) {

                errores.push(
                    `Productor superior inexistente: ${id}`
                );

            } else {

                if (
                    pas.estado === "ACTIVO" &&
                    superior.estado !== "ACTIVO"
                ) {

                    advertencias.push(
                        `Productor superior no activo: ${id}`
                    );
                }

                if (
                    tipoGestion === "GESTIONADO_POR_ORGANIZADOR"
                ) {

                    porOrganizador[superior.id] =
                        (porOrganizador[superior.id] ?? 0) + 1;
                }
            }

            if (tieneRelacionCircular(pas, productoresPorId)) {

                errores.push(
                    `Relación jerárquica circular: ${id}`
                );
            }
        }
    }

    console.log("\nDISTRIBUCIÓN POR TIPO DE GESTIÓN:");
    console.table(distribucion);

    console.log("\nASIGNACIONES DIRECTAS POR EJECUTIVA:");
    console.table(porEjecutiva);

    console.log("\nPRODUCTORES GESTIONADOS POR ORGANIZADOR:");

    console.table(
        Object.entries(porOrganizador).map(
            ([id, cantidad]) => ({
                id,
                organizador: productoresPorId.get(id)?.nombre,
                cantidad
            })
        )
    );

    console.log("\nRESUMEN:");

    console.table({
        productores: productores.length,
        ejecutivas: ejecutivas.length,
        errores: errores.length,
        advertencias: advertencias.length
    });

    if (errores.length > 0) {

        console.log("\nERRORES:");
        console.table(errores);
    }

    if (advertencias.length > 0) {

        console.log("\nADVERTENCIAS:");
        console.table(advertencias);
    }

    console.log("\nNo se realizaron escrituras en Firestore.");

    if (errores.length > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error("Error durante la auditoría:", error);
    process.exitCode = 1;
});