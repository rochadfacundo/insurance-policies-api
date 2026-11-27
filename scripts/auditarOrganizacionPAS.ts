import * as dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestorePASRepository } from "../src/repositories/firestorePASRepository";

interface CodigoAuditoria {
    aseguradoraId: string;
    codigo: string;
}

interface ProductorAuditoria {
    nombre: string;
    matricula: string | null;
    codigos: CodigoAuditoria[];
}

// ============================================================
// CONFIGURACIÓN DE LA AUDITORÍA
// ==========================================================
// ============================================================
// CONFIGURACIÓN DE LA AUDITORÍA
// ============================================================

const ORGANIZADOR = "ALFIERI";

const PRODUCTORES: ProductorAuditoria[] = [
    {
        nombre: "ALFIERI",
        matricula: "92331",
        codigos: [
            { aseguradoraId: "atm", codigo: "10238" },
            { aseguradoraId: "rio-uruguay", codigo: "7900" },
            { aseguradoraId: "rio-uruguay", codigo: "15951" }
        ]
    },
    {
        nombre: "ALVES",
        matricula: "53566",
        codigos: [
            { aseguradoraId: "rio-uruguay", codigo: "15037" }
        ]
    },
    {
        nombre: "GATICA",
        matricula: "101781",
        codigos: [
            { aseguradoraId: "atm", codigo: "10813" },
            { aseguradoraId: "rio-uruguay", codigo: "15105" }
        ]
    },
    {
        nombre: "FLORES",
        matricula: "101722",
        codigos: [
            { aseguradoraId: "atm", codigo: "11223" },
            { aseguradoraId: "rio-uruguay", codigo: "15550" }
        ]
    },
    {
        nombre: "GIL",
        matricula: "38410",
        codigos: [
            { aseguradoraId: "rio-uruguay", codigo: "15526" }
        ]
    },
    {
        nombre: "SALMONE",
        matricula: "83849",
        codigos: [
            { aseguradoraId: "rio-uruguay", codigo: "15524" }
        ]
    },
    {
        nombre: "GONZALEZ",
        matricula: null,
        codigos: [
            { aseguradoraId: "atm", codigo: "11442" }
        ]
    },
    {
        nombre: "REY",
        matricula: "85762",
        codigos: [
            { aseguradoraId: "rio-uruguay", codigo: "16717" }
        ]
    },
    {
        nombre: "ALVES",
        matricula: "83619",
        codigos: [
            { aseguradoraId: "rio-uruguay", codigo: "17460" }
        ]
    }
];
// ============================================================
// NORMALIZACIÓN
// ============================================================

function normalizar(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

// ============================================================
// AUDITORÍA
// ============================================================

async function main(): Promise<void> {

    const firestore = FirebaseConfig.getFirestore();
    const repository = new FirestorePASRepository(firestore);

    const productores = await repository.obtenerTodos();

    console.log("Total de PAS registrados:", productores.length);

    console.log("\n====================================");
    console.log("ORGANIZADOR:", ORGANIZADOR);
    console.log("====================================");

    const organizadores = productores.filter(pas =>
        normalizar(pas.nombre).includes(normalizar(ORGANIZADOR))
    );

    console.dir(organizadores, { depth: null });

    for (const buscado of PRODUCTORES) {

        console.log("\n====================================");
        console.log("PRODUCTOR:", buscado.nombre);
        console.log("====================================");

        const coincidencias = productores.filter(pas =>

            normalizar(pas.nombre).includes(
                normalizar(buscado.nombre)
            ) ||

            (
                buscado.matricula !== null &&
                pas.matricula === buscado.matricula
            )
        );

        console.log("\nCoincidencias por nombre o matrícula:");

        console.dir(coincidencias, { depth: null });

        for (const codigo of buscado.codigos) {

            const titulares = productores.filter(pas =>
                pas.companias.some(compania =>
                    compania.aseguradoraId === codigo.aseguradoraId &&
                    compania.codigos.includes(codigo.codigo)
                )
            );

            console.log(
                `\nCódigo: ${codigo.aseguradoraId} - ${codigo.codigo}`
            );

            console.table(titulares.map(pas => ({
                id: pas.id,
                nombre: pas.nombre,
                matricula: pas.matricula,
                estado: pas.estado,
                ejecutivaId: pas.ejecutivaId,
                productorSuperiorId: pas.productorSuperiorId
            })));
        }
    }

    console.log("\nAuditoría finalizada.");
    console.log("No se realizaron escrituras.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});