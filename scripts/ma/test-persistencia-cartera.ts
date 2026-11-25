import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import assert from "node:assert/strict";

import { FirebaseConfig } from "../../src/config/firebaseConfig";
import { FirestorePASRepository } from "../../src/repositories/firestorePASRepository";
import { FirestorePolizaCarteraRepository } from "../../src/repositories/firestorePolizaCarteraRepository";

import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";
import { MercantilPASResolver } from "../../src/companias/mercantil/services/mercantilPASResolver";
import { MercantilCarteraSyncService } from "../../src/companias/mercantil/services/mercantilCarteraSyncService";

import { PolizaCartera } from "../../src/models/polizaCartera";
import { ECompania } from "../../src/models/eCompania";
import { getApp } from "firebase-admin/app";

const APLICAR = process.argv.includes("--aplicar");

const CODIGOS_PRUEBA = [
    98871,
    94707,
    12929
];

const COMPANIA = ECompania.MERCANTIL_ANDINA;

async function main(): Promise<void> {

    const inicio = Date.now();

    const firestore = FirebaseConfig.getFirestore();

    const pasRepository =
        new FirestorePASRepository(firestore);

    const carteraRepository =
        new FirestorePolizaCarteraRepository(firestore);

    const productoresPAS =
        await pasRepository.obtenerTodos();

    const productoresMercantil =
        obtenerProductoresMercantil();

    const resolver =
        new MercantilPASResolver(productoresPAS);

    const syncService =
        new MercantilCarteraSyncService(resolver);

    const polizas: PolizaCartera[] = [];

    console.log("\n======================================");
    console.log("TEST PERSISTENCIA CARTERA MERCANTIL");
    console.log("======================================");

    console.log(
        `Modo: ${APLICAR ? "APLICACIÓN" : "SIMULACIÓN"}`
    );

    console.log(`Proyecto Firebase: ${getApp().options.projectId ?? "No informado explícitamente"}`);

    // ==========================================
    // 1. OBTENER CARTERA
    // ==========================================

    for (const codigo of CODIGOS_PRUEBA) {

        const productor = productoresMercantil.find(
            p => p.codigo === codigo
        );

        if (!productor) {

            throw new Error(
                `Productor ${codigo} no encontrado.`
            );
        }

        console.log(
            `\nSincronizando ${codigo} - ${productor.nombre}`
        );

        const resultado =
            await syncService.sincronizar(productor);

        polizas.push(...resultado);
    }

    // ==========================================
    // 2. VALIDACIONES PREVIAS
    // ==========================================

    assert.ok(
        polizas.length > 0,
        "No se obtuvieron pólizas."
    );

    const ids = new Set(
        polizas.map(p => p.id)
    );

    assert.equal(
        ids.size,
        polizas.length,
        "Existen pólizas duplicadas."
    );

    for (const poliza of polizas) {

        assert.equal(poliza.compania, COMPANIA);

        assert.ok(
            CODIGOS_PRUEBA.includes(poliza.productor.codigo)
        );

        assert.equal(
            poliza.id,
            `MERCANTIL_${poliza.numeroPoliza}`
        );

        assert.ok(
            Number.isFinite(
                poliza.facturacion.desde.getTime()
            )
        );

        assert.ok(
            Number.isFinite(
                poliza.facturacion.hasta.getTime()
            )
        );

        assert.ok(
            Number.isFinite(
                poliza.finVigencia.getTime()
            )
        );

        assert.equal(
            poliza.primaAnualizada === null,
            poliza.premioAnualizado === null
        );

        assert.equal(
            poliza.primaAnualizada === null,
            poliza.endosoEconomico === null
        );

        if (poliza.endosoEconomico === null) {

            assert.equal(
                poliza.historialRestringido,
                true
            );
        }
    }

    console.log("\nVALIDACIONES PREVIAS: OK");

    console.table(
        CODIGOS_PRUEBA.map(codigo => {

            const cartera = polizas.filter(
                p => p.productor.codigo === codigo
            );

            return {

                codigo,

                polizas: cartera.length,

                asociadas: cartera.filter(
                    p => p.pasId !== null
                ).length,

                sinAsociar: cartera.filter(
                    p => p.pasId === null
                ).length,

                sinImportes: cartera.filter(
                    p => p.primaAnualizada === null
                ).length
            };
        })
    );

    // ==========================================
    // 3. ESTADO PREVIO EN FIRESTORE
    // ==========================================

    const existentes =
        await carteraRepository.obtenerPorCompania(
            COMPANIA
        );

    const indiceExistentes = new Map(
        existentes.map(p => [p.id, p])
    );

    const nuevas = polizas.filter(
        p => !indiceExistentes.has(p.id)
    );

    const actualizaciones = polizas.filter(
        p => indiceExistentes.has(p.id)
    );

    console.log("\nOPERACIONES PREVISTAS:");

    console.log({

        polizasExistentes: existentes.length,

        polizasRecibidas: polizas.length,

        nuevas: nuevas.length,

        actualizaciones: actualizaciones.length,

        eliminaciones: 0
    });

    // Protección adicional para esta prueba:
    // no sobrescribir asociaciones existentes
    // que sean diferentes de las recién resueltas.

    for (const poliza of actualizaciones) {

        const anterior =
            indiceExistentes.get(poliza.id);

        if (
            anterior?.pasId != null &&
            anterior.pasId !== poliza.pasId
        ) {

            throw new Error(
                `Conflicto de asociación en ${poliza.id}. ` +
                `PAS anterior: ${anterior.pasId}. ` +
                `PAS nuevo: ${poliza.pasId}.`
            );
        }

        if (
            anterior &&
            anterior.endoso > poliza.endoso
        ) {

            throw new Error(
                `Endoso anterior al almacenado en ${poliza.id}.`
            );
        }
    }

    // ==========================================
    // 4. FINALIZAR SI ES SIMULACIÓN
    // ==========================================

    if (!APLICAR) {

        console.log("\n======================================");
        console.log("SIMULACIÓN FINALIZADA");
        console.log("======================================");

        console.log(
            `Documentos preparados: ${polizas.length}`
        );

        console.log(
            "No se realizaron escrituras en Firestore."
        );

        console.log(
            `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)}s`
        );

        return;
    }

    // ==========================================
    // 5. PRIMERA ESCRITURA
    // ==========================================

    console.log("\nGUARDANDO PÓLIZAS EN FIRESTORE...");

    await carteraRepository.guardarMuchas(polizas);

    console.log("Primera escritura completada.");

    // ==========================================
    // 6. VERIFICAR DOCUMENTOS GUARDADOS
    // ==========================================

    const primeraLectura =
        await carteraRepository.obtenerPorCompania(
            COMPANIA
        );

    const indicePrimeraLectura = new Map(
        primeraLectura.map(p => [p.id, p])
    );

    const cantidadEsperada =
        existentes.length + nuevas.length;

    assert.equal(
        primeraLectura.length,
        cantidadEsperada,
        "Cantidad inesperada de documentos."
    );

    for (const original of polizas) {

        const guardada =
            indicePrimeraLectura.get(original.id);

        assert.ok(
            guardada,
            `No se encontró ${original.id}.`
        );

        verificarContenido(original, guardada);

        assert.ok(guardada.fechaCreacion);

        assert.ok(guardada.fechaActualizacion);

        const anterior =
            indiceExistentes.get(original.id);

        if (anterior?.fechaCreacion) {

            assert.equal(
                guardada.fechaCreacion.getTime(),
                anterior.fechaCreacion.getTime(),
                `Cambió fechaCreacion de ${original.id}.`
            );
        }
    }

    console.log("Lectura y contenido: OK");

    // ==========================================
    // 7. VERIFICAR CONSULTAS DEL REPOSITORIO
    // ==========================================

    for (const codigo of CODIGOS_PRUEBA) {

        const recuperadas =
            await carteraRepository.obtenerPorProductor(
                COMPANIA,
                codigo
            );

        const idsRecuperados = new Set(
            recuperadas.map(p => p.id)
        );

        const esperadas = polizas.filter(
            p => p.productor.codigo === codigo
        );

        for (const poliza of esperadas) {

            assert.ok(
                idsRecuperados.has(poliza.id),
                `No se recuperó ${poliza.id} por productor.`
            );
        }

        console.log(
            `Consulta productor ${codigo}: OK`
        );
    }

    const asociadas = polizas.filter(
        p => p.pasId !== null
    );

    const pasIds = new Set(
        asociadas.map(p => p.pasId!)
    );

    for (const pasId of pasIds) {

        const recuperadas =
            await carteraRepository.obtenerPorPAS(
                pasId,
                COMPANIA
            );

        const idsRecuperados = new Set(
            recuperadas.map(p => p.id)
        );

        const esperadas = asociadas.filter(
            p => p.pasId === pasId
        );

        for (const poliza of esperadas) {

            assert.ok(
                idsRecuperados.has(poliza.id),
                `No se recuperó ${poliza.id} por PAS.`
            );
        }

        console.log(`Consulta PAS ${pasId}: OK`);
    }

    const sinAsociar =
        await carteraRepository.obtenerSinAsociar(
            COMPANIA
        );

    const idsSinAsociar = new Set(
        sinAsociar.map(p => p.id)
    );

    for (const poliza of polizas) {

        assert.equal(
            idsSinAsociar.has(poliza.id),
            poliza.pasId === null
        );
    }

    console.log("Consulta pólizas sin asociación: OK");

    const ejemplo =
        await carteraRepository.obtenerPorId(
            polizas[0]!.id
        );

    assert.ok(ejemplo);

    verificarContenido(polizas[0]!, ejemplo);

    console.log("Consulta por ID: OK");

    // ==========================================
    // 8. SEGUNDA ESCRITURA
    // ==========================================

    console.log("\nVERIFICANDO IDEMPOTENCIA...");

    await new Promise<void>(
        resolve => setTimeout(resolve, 1100)
    );

    await carteraRepository.guardarMuchas(polizas);

    const segundaLectura =
        await carteraRepository.obtenerPorCompania(
            COMPANIA
        );

    assert.equal(
        segundaLectura.length,
        primeraLectura.length,
        "La segunda escritura modificó la cantidad de documentos."
    );

    const indiceSegundaLectura = new Map(
        segundaLectura.map(p => [p.id, p])
    );

    for (const original of polizas) {

        const primera =
            indicePrimeraLectura.get(original.id);

        const segunda =
            indiceSegundaLectura.get(original.id);

        assert.ok(primera);
        assert.ok(segunda);

        verificarContenido(original, segunda);

        assert.ok(primera.fechaCreacion);
        assert.ok(segunda.fechaCreacion);

        assert.ok(primera.fechaActualizacion);
        assert.ok(segunda.fechaActualizacion);

        assert.equal(
            primera.fechaCreacion.getTime(),
            segunda.fechaCreacion.getTime(),
            `Cambió fechaCreacion de ${original.id}.`
        );

        assert.ok(
            segunda.fechaActualizacion.getTime() >
            primera.fechaActualizacion.getTime(),
            `No se actualizó fechaActualizacion de ${original.id}.`
        );
    }

    console.log("Idempotencia de contenido: OK");
    console.log("Conservación de fechaCreacion: OK");
    console.log("Actualización de fechaActualizacion: OK");

    // ==========================================
    // 9. RESUMEN FINAL
    // ==========================================

    console.log("\n======================================");
    console.log("RESULTADO FINAL");
    console.log("======================================");

    console.log({

        productoresProcesados: CODIGOS_PRUEBA.length,

        polizasProcesadas: polizas.length,

        documentosNuevos: nuevas.length,

        documentosActualizados: actualizaciones.length,

        asociadas: asociadas.length,

        sinAsociar: polizas.length - asociadas.length,

        sinImportes: polizas.filter(
            p => p.primaAnualizada === null
        ).length,

        historialRestringido: polizas.filter(
            p => p.historialRestringido
        ).length,

        documentosDespuesPrimeraEscritura:
            primeraLectura.length,

        documentosDespuesSegundaEscritura:
            segundaLectura.length,

        eliminaciones: 0,

        estado: "OK"
    });

    console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)}s`
    );

    console.log(
        "Persistencia verificada correctamente."
    );
}

/**
 * Compara el contenido de negocio sin considerar
 * las fechas de auditoría administradas por Firestore.
 */
function verificarContenido(
    original: PolizaCartera,
    guardada: PolizaCartera
): void {

    assert.deepEqual(
        obtenerContenido(original),
        obtenerContenido(guardada),
        `Contenido diferente en ${original.id}.`
    );
}

function obtenerContenido(poliza: PolizaCartera) {

    const {
        fechaCreacion,
        fechaActualizacion,
        ...contenido
    } = poliza;

    return contenido;
}

main().catch(error => {

    console.error("\nERROR EN PRUEBA DE PERSISTENCIA:");

    console.error(error);

    console.error(
        "Si se ejecutó con --aplicar, podrían existir " +
        "escrituras realizadas antes del error."
    );

    process.exitCode = 1;
});