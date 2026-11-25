import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../../src/config/firebaseConfig";
import { FirestorePASRepository } from "../../src/repositories/firestorePASRepository";

import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";

import { MercantilPASResolver } from "../../src/companias/mercantil/services/mercantilPASResolver";

import { MercantilCarteraSyncService } from "../../src/companias/mercantil/services/mercantilCarteraSyncService";

import { PolizaCartera } from "../../src/models/polizaCartera";

const CODIGOS_PRUEBA = [98871, 94707, 12929];

const POLIZAS_TRANSFERIDAS = [
    517042777,
    516809023,
    91566730,
    517413151
];

async function main(): Promise<void> {

    const inicio = Date.now();

    const firestore = FirebaseConfig.getFirestore();

    const pasRepository =
        new FirestorePASRepository(firestore);

    const productoresPAS =
        await pasRepository.obtenerTodos();

    const productoresMercantil =
        obtenerProductoresMercantil();

    const resolver =
        new MercantilPASResolver(productoresPAS);

    const syncService =
        new MercantilCarteraSyncService(resolver);

    const todasLasPolizas: PolizaCartera[] = [];

    const resumen = [];

    let productoresConError = 0;

    console.log("\n======================================");
    console.log("TEST SINCRONIZACIÓN CARTERA MERCANTIL");
    console.log("======================================");

    // ==========================================
    // 1. PROCESAR PRODUCTORES
    // ==========================================

    for (const codigo of CODIGOS_PRUEBA) {

        const productor = productoresMercantil.find(
            p => p.codigo === codigo
        );

        if (!productor) {

            console.error(
                `Productor ${codigo} no encontrado.`
            );

            productoresConError++;

            continue;
        }

        const inicioProductor = Date.now();

        console.log("\n--------------------------------------");
        console.log(`${codigo} - ${productor.nombre}`);
        console.log("--------------------------------------");

        try {

            const polizas =
                await syncService.sincronizar(productor);

            todasLasPolizas.push(...polizas);

            resumen.push({

                codigo,

                productor: productor.nombre,

                pasId: resolver.resolver(productor),

                polizas: polizas.length,

                asociadas: polizas.filter(
                    p => p.pasId !== null
                ).length,

                sinAsociar: polizas.filter(
                    p => p.pasId === null
                ).length,

                sinImportes: polizas.filter(
                    p => p.primaAnualizada === null ||
                         p.premioAnualizado === null
                ).length,

                historialRestringido: polizas.filter(
                    p => p.historialRestringido
                ).length,

                duracion:
                    `${((Date.now() - inicioProductor) / 1000).toFixed(2)}s`,

                estado: "OK"
            });

        } catch (error: unknown) {

            productoresConError++;

            const mensaje = error instanceof Error
                ? error.message
                : String(error);

            console.error(mensaje);

            resumen.push({

                codigo,

                productor: productor.nombre,

                estado: "ERROR",

                mensaje
            });
        }
    }

    // ==========================================
    // 2. RESUMEN POR PRODUCTOR
    // ==========================================

    console.log("\n======================================");
    console.log("RESUMEN POR PRODUCTOR");
    console.log("======================================");

    console.table(resumen);

    // ==========================================
    // 3. PÓLIZAS TRANSFERIDAS CONOCIDAS
    // ==========================================

    console.log("\n======================================");
    console.log("TRANSFERENCIAS CONOCIDAS");
    console.log("======================================");

    console.table(

        POLIZAS_TRANSFERIDAS.map(numero => {

            const poliza = todasLasPolizas.find(
                p => p.numeroPoliza === numero
            );

            if (!poliza) {

                return {
                    poliza: numero,
                    estado: "NO ENCONTRADA"
                };
            }

            return {

                poliza: numero,

                codigo: poliza.productor.codigo,

                pasId: poliza.pasId,

                endoso: poliza.endoso,

                endosoEconomico: poliza.endosoEconomico,

                prima: poliza.primaAnualizada,

                premio: poliza.premioAnualizado,

                historialRestringido:
                    poliza.historialRestringido,

                periodicidad:
                    poliza.periodicidadFacturacion,

                estado: "ENCONTRADA"
            };
        })
    );

    // ==========================================
    // 4. DISTRIBUCIÓN DE PERIODICIDADES
    // ==========================================

    const periodicidades: Record<string, number> = {};

    for (const poliza of todasLasPolizas) {

        const tipo = poliza.periodicidadFacturacion;

        periodicidades[tipo] =
            (periodicidades[tipo] ?? 0) + 1;
    }

    console.log("\nPERIODICIDADES:");

    console.table(periodicidades);

    // ==========================================
    // 5. VALIDAR DUPLICADOS
    // ==========================================

    const cantidadPorId = new Map<string, number>();

    for (const poliza of todasLasPolizas) {

        cantidadPorId.set(
            poliza.id,
            (cantidadPorId.get(poliza.id) ?? 0) + 1
        );
    }

    const duplicados = [...cantidadPorId.entries()]
        .filter(([, cantidad]) => cantidad > 1)
        .map(([id, cantidad]) => ({
            id,
            cantidad
        }));

    console.log("\nPÓLIZAS DUPLICADAS:");

    console.table(duplicados);

    // ==========================================
    // 6. VALIDAR INFORMACIÓN ECONÓMICA
    // ==========================================

    const inconsistenciasEconomicas =
        todasLasPolizas.filter(p => {

            const tienePrima =
                p.primaAnualizada !== null;

            const tienePremio =
                p.premioAnualizado !== null;

            const tieneEndosoEconomico =
                p.endosoEconomico !== null;

            return (
                tienePrima !== tienePremio ||
                tienePrima !== tieneEndosoEconomico ||
                (!tieneEndosoEconomico &&
                    !p.historialRestringido)
            );
        });

    console.log("\nINCONSISTENCIAS ECONÓMICAS:");

    console.table(

        inconsistenciasEconomicas.map(p => ({

            poliza: p.numeroPoliza,

            prima: p.primaAnualizada,

            premio: p.premioAnualizado,

            endosoEconomico: p.endosoEconomico,

            historialRestringido:
                p.historialRestringido
        }))
    );

    // ==========================================
    // 7. EJEMPLO DEL DOCUMENTO FINAL
    // ==========================================

    const ejemplo = todasLasPolizas.find(
        p => p.numeroPoliza === 517042777
    ) ?? todasLasPolizas[0];

    if (ejemplo) {

        console.log("\nEJEMPLO DOCUMENTO CARTERA:");

        console.log(
            JSON.stringify(ejemplo, null, 2)
        );
    }

    // ==========================================
    // 8. RESUMEN GENERAL
    // ==========================================

    const transferenciasNoEncontradas =
        POLIZAS_TRANSFERIDAS.filter(
            numero => !todasLasPolizas.some(
                p => p.numeroPoliza === numero
            )
        );

    console.log("\n======================================");
    console.log("RESULTADO GENERAL");
    console.log("======================================");

    console.log({

        productoresEvaluados:
            CODIGOS_PRUEBA.length,

        productoresCorrectos:
            CODIGOS_PRUEBA.length - productoresConError,

        productoresConError,

        totalPolizas:
            todasLasPolizas.length,

        asociadas:
            todasLasPolizas.filter(
                p => p.pasId !== null
            ).length,

        sinAsociar:
            todasLasPolizas.filter(
                p => p.pasId === null
            ).length,

        sinImportes:
            todasLasPolizas.filter(
                p => p.primaAnualizada === null ||
                     p.premioAnualizado === null
            ).length,

        historialRestringido:
            todasLasPolizas.filter(
                p => p.historialRestringido
            ).length,

        duplicados:
            duplicados.length,

        inconsistenciasEconomicas:
            inconsistenciasEconomicas.length,

        transferenciasNoEncontradas
    });

    console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("No se realizaron escrituras en Firestore.");

    if (
        productoresConError > 0 ||
        duplicados.length > 0 ||
        inconsistenciasEconomicas.length > 0 ||
        transferenciasNoEncontradas.length > 0 ||
        todasLasPolizas.length === 0
    ) {

        process.exitCode = 1;
    }
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});