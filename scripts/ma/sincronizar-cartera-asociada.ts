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

const APLICAR = process.argv.includes("--aplicar");
const SOLO_LISTADO = process.argv.includes("--solo-listado");
const argumentoCodigo = process.argv.find(
    argumento => argumento.startsWith("--codigo=")
);

const CODIGO_PRODUCTOR = argumentoCodigo
    ? Number(argumentoCodigo.split("=")[1])
    : null;

const COMPANIA = ECompania.MERCANTIL_ANDINA;

const PAUSA_ENTRE_PRODUCTORES_MS = 500;

interface ResultadoProductor {

    codigo: number;
    nombre: string;
    pasId: string;

    estado: "OK" | "SIN_POLIZAS" | "ERROR";

    polizas: number;
    nuevas: number;
    actualizadas: number;
    sinImportes: number;
    historialRestringido: number;

    // Nuevos campos
    sinFinVigencia: number;
    monedas: Record<string, number>;
    sinMonedaConImportes: number;

    error?: string;
}

async function main(): Promise<void> {

    const inicio = Date.now();

    assert.ok(
        !(APLICAR && SOLO_LISTADO),
        "No se pueden combinar --aplicar y --solo-listado."
    );

    assert.ok(
        CODIGO_PRODUCTOR === null ||
        (
            Number.isSafeInteger(CODIGO_PRODUCTOR) &&
            CODIGO_PRODUCTOR > 0
        ),
        "El código de productor debe ser un entero positivo."
    );

    console.log("\n======================================");
    console.log("SINCRONIZACIÓN CARTERA MERCANTIL");
    console.log("======================================");

    console.log(
        `Modo: ${
            SOLO_LISTADO
                ? "SOLO LISTADO"
                : APLICAR
                    ? "APLICACIÓN"
                    : "SIMULACIÓN"
        }`
    );

    // ==========================================
    // 1. INICIALIZACIÓN
    // ==========================================

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

    // ==========================================
    // 2. SELECCIONAR PRODUCTORES ASOCIADOS
    // ==========================================

    const productoresActivos =
        productoresMercantil.filter(
            productor => productor.estado_id === 1
        );

    const todosProductoresAsociados = productoresActivos
        .map(productor => ({
            productor,
            pasId: resolver.resolver(productor)
        }))
        .filter(
            (
                registro
            ): registro is typeof registro & { pasId: string } =>
                registro.pasId !== null
        )
        .sort(
            (a, b) => a.productor.codigo - b.productor.codigo
        );

    const productoresAsociados = todosProductoresAsociados.filter(
            ({ productor }) =>
                CODIGO_PRODUCTOR === null ||
                productor.codigo === CODIGO_PRODUCTOR
        );

    const codigos = new Set(
        productoresAsociados.map(
            registro => registro.productor.codigo
        )
    );

    assert.equal(
        codigos.size,
        productoresAsociados.length,
        "Existen códigos de productor duplicados."
    );

    const pasIds = new Set(
        productoresAsociados.map(
            registro => registro.pasId
        )
    );

    console.log("\nPRODUCTORES SELECCIONADOS:");

    console.log({

        productoresCatalogo: productoresMercantil.length,

        productoresActivos: productoresActivos.length,

        codigosAsociados: todosProductoresAsociados.length,

        productoresSeleccionados: productoresAsociados.length,

        filtroCodigo: CODIGO_PRODUCTOR,

        pasDistintos: pasIds.size,

        codigosSinAsociar:  productoresActivos.length - todosProductoresAsociados.length
    });

    console.table(
        productoresAsociados.map(({ productor, pasId }) => ({
            codigo: productor.codigo,
            nombre: productor.nombre,
            matricula: productor.matricula,
            pasId
        }))
    );

    assert.ok(
        productoresAsociados.length > 0,
        "No se encontraron productores asociados."
    );

    if (SOLO_LISTADO) {

        console.log("\nLISTADO FINALIZADO.");

        console.log(
            "No se consultó Mercantil ni se realizaron escrituras."
        );

        return;
    }

    // ==========================================
    // 3. ESTADO PREVIO EN FIRESTORE
    // ==========================================

    const existentes =
        await carteraRepository.obtenerPorCompania(
            COMPANIA
        );

    const indiceExistentes = new Map(
        existentes.map(poliza => [
            poliza.id,
            poliza
        ])
    );

    const idsProcesados = new Map<string, number>();

    const resultados: ResultadoProductor[] = [];

    console.log(
        `\nPólizas existentes en Firestore: ${existentes.length}`
    );

    // ==========================================
    // 4. SINCRONIZACIÓN POR PRODUCTOR
    // ==========================================

    for (let i = 0; i < productoresAsociados.length; i++) {

        const { productor, pasId } =
            productoresAsociados[i]!;

        const inicioProductor = Date.now();

        console.log("\n--------------------------------------");

        console.log(
            `[${i + 1}/${productoresAsociados.length}] ` +
            `${productor.codigo} - ${productor.nombre}`
        );

        console.log(`PAS: ${pasId}`);

        const resultado: ResultadoProductor = {

            codigo: productor.codigo,
            nombre: productor.nombre,
            pasId,
        
            estado: "OK",
        
            polizas: 0,
            nuevas: 0,
            actualizadas: 0,
            sinImportes: 0,
            historialRestringido: 0,
        
            // Nuevos campos de auditoría
            sinFinVigencia: 0,
            monedas: {},
            sinMonedaConImportes: 0
        };

        try {

            // ==========================================
            // 4.1 OBTENER CARTERA
            // ==========================================

            const polizas =
                await syncService.sincronizar(productor);

            resultado.polizas = polizas.length;

            if (polizas.length === 0) {

                resultado.estado = "SIN_POLIZAS";

                console.log(
                    "El productor no tiene pólizas devueltas por la API."
                );

            } else {

                // ==========================================
                // 4.2 VALIDACIONES
                // ==========================================

                validarCartera(
                    polizas,
                    productor.codigo,
                    pasId,
                    indiceExistentes,
                    idsProcesados
                );

                resultado.nuevas = polizas.filter(
                    poliza => !indiceExistentes.has(poliza.id)
                ).length;

                resultado.actualizadas = polizas.filter(
                    poliza => indiceExistentes.has(poliza.id)
                ).length;

                resultado.sinImportes = polizas.filter(
                    poliza => poliza.primaAnualizada === null
                ).length;

                resultado.historialRestringido = polizas.filter(
                    poliza => poliza.historialRestringido
                ).length;

                resultado.sinFinVigencia = polizas.filter(
                    poliza => poliza.finVigencia === null
                ).length;
                
                resultado.sinMonedaConImportes = polizas.filter(
                    poliza =>
                        poliza.moneda === null &&
                        poliza.primaAnualizada !== null
                ).length;
                
                for (const poliza of polizas) {
                
                    const moneda = poliza.moneda ?? "NO_INFORMADA";
                
                    resultado.monedas[moneda] =
                        (resultado.monedas[moneda] ?? 0) + 1;
                }

                console.table(
                    polizas
                        .filter(poliza =>
                            poliza.finVigencia === null ||
                            poliza.moneda !== "ARS"
                        )
                        .map(poliza => ({
                            poliza: poliza.numeroPoliza,
                            ramo: poliza.ramo.nombre,
                            moneda: poliza.moneda,
                            prima: poliza.primaAnualizada,
                            premio: poliza.premioAnualizado,
                            finVigencia: poliza.finVigencia
                        }))
                );
                // Reservar los IDs validados para detectar
                // conflictos entre productores de esta ejecución.

                for (const poliza of polizas) {

                    idsProcesados.set(
                        poliza.id,
                        productor.codigo
                    );
                }

                // ==========================================
                // 4.3 PERSISTENCIA
                // ==========================================

                if (APLICAR) {

                    await carteraRepository.guardarMuchas(
                        polizas
                    );

                    console.log(
                        "Persistencia completada."
                    );

                } else {

                    console.log(
                        "Simulación: pólizas preparadas."
                    );
                }

                // Actualizar el índice local después
                // de procesar correctamente el productor.

                for (const poliza of polizas) {

                    indiceExistentes.set(
                        poliza.id,
                        poliza
                    );
                }

                console.log({

                    polizas: resultado.polizas,

                    nuevas: resultado.nuevas,

                    actualizadas: resultado.actualizadas,

                    sinImportes: resultado.sinImportes,

                    historialRestringido:
                        resultado.historialRestringido
                });
            }

        } catch (error: unknown) {

            resultado.estado = "ERROR";

            resultado.error =
                error instanceof Error
                    ? error.message
                    : String(error);

            console.error(
                `Error procesando productor ${productor.codigo}:`,
                resultado.error
            );

            if (APLICAR) {

                console.error(
                    "Si falló la persistencia, podrían existir " +
                    "escrituras parciales de este productor."
                );
            }
        }

        resultados.push(resultado);

        console.log(
            `Duración productor: ${formatearDuracion(
                Date.now() - inicioProductor
            )}`
        );

        console.log(
            `Tiempo acumulado: ${formatearDuracion(
                Date.now() - inicio
            )}`
        );

        if (i < productoresAsociados.length - 1) {

            await esperar(
                PAUSA_ENTRE_PRODUCTORES_MS
            );
        }
    }

    // ==========================================
    // 5. RESUMEN FINAL
    // ==========================================

    const exitosos = resultados.filter(
        resultado => resultado.estado === "OK"
    );

    const sinPolizas = resultados.filter(
        resultado => resultado.estado === "SIN_POLIZAS"
    );

    const errores = resultados.filter(
        resultado => resultado.estado === "ERROR"
    );

    const sumar = (
        campo:
            | "polizas"
            | "nuevas"
            | "actualizadas"
            | "sinImportes"
            | "historialRestringido"
    ): number => {

        return exitosos.reduce(
            (total, resultado) => total + resultado[campo],
            0
        );
    };

    console.log("\n======================================");
    console.log("RESULTADO FINAL");
    console.log("======================================");

    console.table(resultados);

    console.log({

        modo: APLICAR ? "APLICACIÓN" : "SIMULACIÓN",

        productoresSeleccionados:
            productoresAsociados.length,

        productoresProcesados:
            resultados.length,

        productoresExitosos:
            exitosos.length,

        productoresSinPolizas:
            sinPolizas.length,

        productoresConErrores:
            errores.length,

        polizasProcesadas:
            sumar("polizas"),

        documentosNuevos:
            sumar("nuevas"),

        documentosActualizados:
            sumar("actualizadas"),

        polizasSinImportes:
            sumar("sinImportes"),

        historialRestringido:
            sumar("historialRestringido"),

        eliminaciones: 0,

        duracion: formatearDuracion(
            Date.now() - inicio
        )
    });

    // ==========================================
    // 6. VERIFICACIÓN FINAL
    // ==========================================

    if (APLICAR) {

        const documentosFinales =
            await carteraRepository.obtenerPorCompania(
                COMPANIA
            );

        const asociados = documentosFinales.filter(
            poliza => poliza.pasId !== null
        );

        console.log("\nESTADO FINAL EN FIRESTORE:");

        console.log({

            documentosIniciales:
                existentes.length,

            documentosFinales:
                documentosFinales.length,

            asociados:
                asociados.length,

            sinAsociar:
                documentosFinales.length -
                asociados.length,

            pasConCartera: new Set(
                asociados.map(poliza => poliza.pasId)
            ).size
        });

    } else {

        console.log(
            "\nNo se realizaron escrituras en Firestore."
        );
    }

    if (errores.length > 0) {

        console.log("\nPRODUCTORES CON ERRORES:");

        console.table(
            errores.map(resultado => ({
                codigo: resultado.codigo,
                nombre: resultado.nombre,
                error: resultado.error
            }))
        );

        process.exitCode = 1;
    }
}

// ==========================================
// VALIDACIONES DE CARTERA
// ==========================================

function validarCartera(
    polizas: PolizaCartera[],
    codigo: number,
    pasId: string,
    existentes: Map<string, PolizaCartera>,
    idsProcesados: Map<string, number>
): void {

    const idsLocales = new Set<string>();

    for (const poliza of polizas) {

        assert.equal(
            poliza.compania,
            COMPANIA
        );

        assert.equal(
            poliza.productor.codigo,
            codigo,
            `Código de productor incorrecto en ${poliza.id}.`
        );

        assert.equal(
            poliza.pasId,
            pasId,
            `Asociación incorrecta en ${poliza.id}.`
        );

        assert.equal(
            poliza.id,
            `MERCANTIL_${poliza.numeroPoliza}`
        );

        assert.ok(
            !idsLocales.has(poliza.id),
            `Póliza duplicada: ${poliza.id}.`
        );

        idsLocales.add(poliza.id);

        // Evitar que una póliza aparezca bajo dos
        // códigos comerciales durante la sincronización.

        const codigoProcesado =
            idsProcesados.get(poliza.id);

        assert.ok(
            codigoProcesado === undefined ||
            codigoProcesado === codigo,

            `Póliza ${poliza.id} informada por ` +
            `dos productores: ${codigoProcesado} y ${codigo}.`
        );

        // Validar fechas.

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
                            poliza.finVigencia === null ||
                Number.isFinite(
                    poliza.finVigencia.getTime()
                )
        );

        // Validar información económica.

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

        } else {

            assert.ok(
                Number.isFinite(poliza.primaAnualizada)
            );

            assert.ok(
                Number.isFinite(poliza.premioAnualizado)
            );

            assert.ok(
                poliza.endosoEconomico <= poliza.endoso
            );
        }

        // ==========================================
        // PROTEGER DOCUMENTOS EXISTENTES
        // ==========================================

        const anterior = existentes.get(poliza.id);

        if (!anterior) {
            continue;
        }

        // No cambiar automáticamente un PAS asociado.

        if (
            anterior.pasId !== null &&
            anterior.pasId !== poliza.pasId
        ) {

            throw new Error(
                `Conflicto de asociación en ${poliza.id}. ` +
                `PAS anterior: ${anterior.pasId}. ` +
                `PAS nuevo: ${poliza.pasId}.`
            );
        }

        // No reemplazar un endoso más reciente.

        if (anterior.endoso > poliza.endoso) {

            throw new Error(
                `Endoso desactualizado en ${poliza.id}. ` +
                `Anterior: ${anterior.endoso}. ` +
                `Nuevo: ${poliza.endoso}.`
            );
        }

        // No cambiar de código comercial automáticamente.

        if (
            anterior.productor.codigo !==
            poliza.productor.codigo
        ) {

            throw new Error(
                `Cambio de código comercial en ${poliza.id}. ` +
                `Anterior: ${anterior.productor.codigo}. ` +
                `Nuevo: ${poliza.productor.codigo}.`
            );
        }

        // No perder información económica conocida.

        if (
            (
                anterior.primaAnualizada !== null &&
                poliza.primaAnualizada === null
            ) ||
            (
                anterior.premioAnualizado !== null &&
                poliza.premioAnualizado === null
            )
        ) {

            throw new Error(
                `Pérdida de información económica en ${poliza.id}.`
            );
        }

        // No retroceder al utilizar un endoso económico.

        if (
            anterior.endosoEconomico !== null &&
            poliza.endosoEconomico !== null &&
            anterior.endosoEconomico > poliza.endosoEconomico
        ) {

            throw new Error(
                `Endoso económico desactualizado en ${poliza.id}.`
            );
        }
    }
}

// ==========================================
// UTILIDADES
// ==========================================

function esperar(ms: number): Promise<void> {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function formatearDuracion(ms: number): string {

    const segundos = Math.floor(ms / 1000);

    const horas = Math.floor(segundos / 3600);

    const minutos = Math.floor(
        (segundos % 3600) / 60
    );

    const restantes = segundos % 60;

    return `${horas}h ${minutos}m ${restantes}s`;
}

main().catch(error => {

    console.error(
        "\nERROR GENERAL DE SINCRONIZACIÓN:"
    );

    console.error(error);

    if (APLICAR) {

        console.error(
            "Podrían existir escrituras realizadas antes del error."
        );
    }

    process.exitCode = 1;
});