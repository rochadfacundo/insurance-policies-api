import dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../../src/config/firebaseConfig";
import { FirestorePASRepository } from "../../src/repositories/firestorePASRepository";
import { obtenerProductoresMercantil } from "../../src/companias/mercantil/models/productoresMercantil";
import { MercantilPASResolver } from "../../src/companias/mercantil/services/mercantilPASResolver";

async function main(): Promise<void> {

    const inicio = Date.now();

    const firestore = FirebaseConfig.getFirestore();

    const repository = new FirestorePASRepository(firestore);

    const productoresPAS = await repository.obtenerTodos();

    const productoresMercantil = obtenerProductoresMercantil();

    const resolver = new MercantilPASResolver(productoresPAS);

    const indicePAS = new Map(
        productoresPAS.map(pas => [pas.id, pas])
    );

    console.log("\n======================================");
    console.log("TEST MERCANTIL PAS RESOLVER");
    console.log("======================================");

    console.log(`PAS en Firestore: ${productoresPAS.length}`);
    console.log(`Productores Mercantil: ${productoresMercantil.length}`);

    // ==================================================
    // 1. RESOLVER ASOCIACIONES
    // ==================================================

    const resultados = productoresMercantil.map(productor => {

        const pasId = resolver.resolver(productor);

        const pas = pasId !== null
            ? indicePAS.get(pasId)
            : undefined;

        return {
            codigo: productor.codigo,
            nombre: productor.nombre,
            matricula: productor.matricula,
            activo: productor.estado_id === 1,
            grupoCartera: productor.grupoCartera ?? "",
            pasId,
            nombrePAS: pas?.nombre ?? null,
            matriculaPAS: pas?.matricula ?? null,
            estadoPAS: pas?.estado ?? null
        };
    });

    // ==================================================
    // 2. CLASIFICAR RESULTADOS
    // ==================================================

    const activos = resultados.filter(r => r.activo);

    const inactivos = resultados.filter(r => !r.activo);

    const asociados = activos.filter(
        r => r.pasId !== null
    );

    const pendientes = activos.filter(
        r => r.pasId === null
    );

    const inactivosAsociados = inactivos.filter(
        r => r.pasId !== null
    );

    const pasUnicos = new Set(
        asociados.map(r => r.pasId)
    );

    const porcentaje = activos.length > 0
        ? (asociados.length / activos.length * 100).toFixed(2)
        : "0.00";

    // ==================================================
    // 3. MOSTRAR ASOCIACIONES
    // ==================================================

    console.log("\nPRIMERAS 15 ASOCIACIONES:");

    console.table(
        asociados.slice(0, 15).map(r => ({
            codigo: r.codigo,
            nombreMercantil: r.nombre,
            nombrePAS: r.nombrePAS,
            pasId: r.pasId,
            estadoPAS: r.estadoPAS
        }))
    );

    console.log("\nPRODUCTORES ACTIVOS SIN ASOCIACIÓN:");

    console.table(
        pendientes.map(r => ({
            codigo: r.codigo,
            nombre: r.nombre,
            matricula: r.matricula,
            grupoCartera: r.grupoCartera
        }))
    );

    // ==================================================
    // 4. PAS CON MÚLTIPLES CÓDIGOS MERCANTIL
    // ==================================================

    const codigosPorPAS = new Map<string, typeof asociados>();

    for (const resultado of asociados) {

        if (resultado.pasId === null) {
            continue;
        }

        const registros =
            codigosPorPAS.get(resultado.pasId) ?? [];

        registros.push(resultado);

        codigosPorPAS.set(resultado.pasId, registros);
    }

    

    const multiplesCodigos = [...codigosPorPAS.entries()]
        .filter(([, registros]) => registros.length > 1)
        .map(([pasId, registros]) => ({
            pasId,
            nombrePAS: registros[0]!.nombrePAS,
            cantidadCodigos: registros.length,
            codigos: registros.map(r => r.codigo).join(", "),
            grupos: registros.map(
                r => r.grupoCartera || "-"
            ).join(" | ")
        }));

    console.log("\nPAS CON MÚLTIPLES CÓDIGOS MERCANTIL:");

    console.table(multiplesCodigos);

    // ==================================================
    // 5. VALIDACIONES
    // ==================================================

    const asociacionesInvalidas = asociados.filter(
        r => r.estadoPAS !== "ACTIVO"
    );

    // ==================================================
    // 6. RESUMEN FINAL
    // ==================================================

    console.log("\n======================================");
    console.log("RESULTADO FINAL");
    console.log("======================================");

    console.log({
        totalMercantil: resultados.length,
        activos: activos.length,
        inactivos: inactivos.length,
        activosAsociados: asociados.length,
        activosSinAsociar: pendientes.length,
        inactivosAsociados: inactivosAsociados.length,
        pasUnicosAsociados: pasUnicos.size,
        pasConMultiplesCodigos: multiplesCodigos.length,
        asociacionesInvalidas: asociacionesInvalidas.length,
        porcentajeAsociado: `${porcentaje}%`
    });

    console.log(
        `\nDuración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );

    console.log("No se realizaron escrituras en Firestore.");
    console.log("No se realizaron consultas a Mercantil.");

    if (asociacionesInvalidas.length > 0) {

        console.error("Se detectaron asociaciones inválidas.");

        process.exitCode = 1;
    }
}

main().catch(error => {

    console.error(error);

    process.exitCode = 1;
});