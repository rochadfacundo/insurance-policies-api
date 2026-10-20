
import dotenv from "dotenv";
import path from "path";
import * as admin from "firebase-admin";

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    __dirname,
    "../src/credentials/firebase-admin.json"
);

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const EJECUTIVA_DEFAULT = "micaela-rocha";

interface ProductorResumen {
    clave: string;
    compania: string;
    codigo: string;
    nombre: string;
    cantidadPolizas: number;
    porDescarte: boolean;
}

interface EjecutivaResumen {
    id: string;
    nombre: string;
    activa: boolean;
    productores: ProductorResumen[];
}

function obtenerClave(
    compania: unknown,
    codigo: unknown
): string {
    return `${String(compania ?? "")}_${String(codigo ?? "")}`;
}

async function main(): Promise<void> {

    console.log("\n==============================================");
    console.log("DIAGNÓSTICO DE CARTERA POR EJECUTIVA");
    console.log("==============================================");

    const [
        ejecutivasSnapshot,
        relacionesSnapshot,
        polizasSnapshot
    ] = await Promise.all([
        db.collection("ejecutivas").get(),
        db.collection("productoresEjecutivas").get(),
        db.collection("polizas").get()
    ]);

    const ejecutivas = new Map<string, EjecutivaResumen>();

    // 1. Cargar ejecutivas desde Firestore
    for (const doc of ejecutivasSnapshot.docs) {

        const data = doc.data();

        ejecutivas.set(doc.id, {
            id: doc.id,
            nombre: `${data.nombre ?? ""} ${data.apellido ?? ""}`.trim(),
            activa: data.activa === true,
            productores: []
        });
    }

    if (!ejecutivas.has(EJECUTIVA_DEFAULT)) {
        throw new Error(
            `No existe la ejecutiva por defecto: ${EJECUTIVA_DEFAULT}`
        );
    }

    // 2. Agrupar pólizas por compañía y código de productor
    const polizasPorProductor = new Map<string, {
        compania: string;
        codigo: string;
        nombre: string;
        cantidad: number;
    }>();

    for (const doc of polizasSnapshot.docs) {

        const poliza = doc.data();

        const compania = String(poliza.compania ?? "");
        const codigo = String(poliza.productor?.codigo ?? "");
        const nombre = String(poliza.productor?.nombre ?? "Sin nombre");

        if (!compania || !codigo) {
            console.warn(
                `Póliza ${doc.id}: sin compañía o código de productor`
            );
            continue;
        }

        const clave = obtenerClave(compania, codigo);
        const existente = polizasPorProductor.get(clave);

        if (existente) {
            existente.cantidad++;
        } else {
            polizasPorProductor.set(clave, {
                compania,
                codigo,
                nombre,
                cantidad: 1
            });
        }
    }

    // 3. Incorporar relaciones existentes a cada ejecutiva
    const productoresConRelacion = new Set<string>();

    for (const doc of relacionesSnapshot.docs) {

        const relacion = doc.data();

        const compania = String(relacion.compania ?? "");
        const codigo = String(relacion.productor?.codigo ?? "");
        const ejecutivaId = String(relacion.ejecutivaId ?? "");

        const clave = obtenerClave(compania, codigo);

        if (!compania || !codigo) {
            console.warn(
                `Relación ${doc.id}: sin compañía o código`
            );
            continue;
        }

        // Si existe relación, no corresponde asignarlo
        // por descarte, aunque la ejecutiva no exista.
        productoresConRelacion.add(clave);

        const ejecutiva = ejecutivas.get(ejecutivaId);

        if (!ejecutiva) {
            console.warn(
                `Relación ${doc.id}: ejecutiva inexistente (${ejecutivaId})`
            );
            continue;
        }

        const datosPolizas = polizasPorProductor.get(clave);

        ejecutiva.productores.push({
            clave,
            compania,
            codigo,
            nombre: String(
                relacion.productor?.nombre ??
                datosPolizas?.nombre ??
                "Sin nombre"
            ),
            cantidadPolizas: datosPolizas?.cantidad ?? 0,
            porDescarte: false
        });
    }

    // 4. Productores con pólizas, pero sin relación
    const micaela = ejecutivas.get(EJECUTIVA_DEFAULT)!;

    for (const [clave, productor] of polizasPorProductor) {

        if (productoresConRelacion.has(clave)) {
            continue;
        }

        micaela.productores.push({
            clave,
            compania: productor.compania,
            codigo: productor.codigo,
            nombre: productor.nombre,
            cantidadPolizas: productor.cantidad,
            porDescarte: true
        });
    }

    // 5. Mostrar productores por ejecutiva
    const resumen = [];

    let totalProductores = 0;
    let totalPolizas = 0;
    let totalPorDescarte = 0;

    const ejecutivasOrdenadas = [...ejecutivas.values()]
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    for (const ejecutiva of ejecutivasOrdenadas) {

        ejecutiva.productores.sort((a, b) =>
            a.compania.localeCompare(b.compania) ||
            a.nombre.localeCompare(b.nombre)
        );

        const asignados = ejecutiva.productores.filter(
            p => !p.porDescarte
        );

        const porDescarte = ejecutiva.productores.filter(
            p => p.porDescarte
        );

        const cantidadPolizas = ejecutiva.productores.reduce(
            (total, p) => total + p.cantidadPolizas,
            0
        );

        console.log("\n==============================================");
        console.log(`EJECUTIVA: ${ejecutiva.nombre}`);
        console.log(`ID: ${ejecutiva.id}`);
        console.log(`Activa: ${ejecutiva.activa}`);
        console.log("==============================================");

        console.log(`Productores asignados: ${asignados.length}`);
        console.log(`Productores por descarte: ${porDescarte.length}`);
        console.log(`Pólizas: ${cantidadPolizas}`);

        console.log("\n--- PRODUCTORES ASIGNADOS ---");

        if (asignados.length === 0) {
            console.log("Ninguno");
        }

        for (const productor of asignados) {
            console.log(
                `[${productor.compania}] ` +
                `${productor.codigo} - ${productor.nombre} ` +
                `(${productor.cantidadPolizas} pólizas)`
            );
        }

        if (porDescarte.length > 0) {

            console.log("\n--- PRODUCTORES POR DESCARTE ---");

            for (const productor of porDescarte) {
                console.log(
                    `[${productor.compania}] ` +
                    `${productor.codigo} - ${productor.nombre} ` +
                    `(${productor.cantidadPolizas} pólizas) ` +
                    "[SIN RELACIÓN EN FIRESTORE]"
                );
            }
        }

        totalProductores += ejecutiva.productores.length;
        totalPolizas += cantidadPolizas;
        totalPorDescarte += porDescarte.length;

        resumen.push({
            ejecutiva: ejecutiva.nombre,
            asignados: asignados.length,
            porDescarte: porDescarte.length,
            totalProductores: ejecutiva.productores.length,
            polizas: cantidadPolizas
        });
    }

    // 6. Resumen general
    console.log("\n==============================================");
    console.log("RESUMEN GENERAL");
    console.log("==============================================\n");

    console.table(resumen);

    console.log(`Ejecutivas: ${ejecutivas.size}`);
    console.log(`Relaciones existentes: ${relacionesSnapshot.size}`);
    console.log(`Productores mostrados: ${totalProductores}`);
    console.log(`Productores por descarte: ${totalPorDescarte}`);
    console.log(`Pólizas contabilizadas: ${totalPolizas}`);
    console.log(`Pólizas en Firestore: ${polizasSnapshot.size}`);

    console.log("\n==============================================");
    console.log("MODO SOLO LECTURA");
    console.log("No se modificó ninguna colección de Firestore.");
    console.log("==============================================");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Error:", error);
        process.exit(1);
    });
