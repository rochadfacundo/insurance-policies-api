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
const ORGANIZADOR = "BAGALA";

const PRODUCTORES: ProductorAuditoria[] = [
    {
        nombre: "BULACIO",
        matricula: "109143",
        codigos: [
            { aseguradoraId: "atm", codigo: "14235" },
            { aseguradoraId: "mercantil-andina", codigo: "17238" },
            { aseguradoraId: "rio-uruguay", codigo: "17243" }
        ]
    },
    {
        nombre: "PETROSILLO",
        matricula: "72392",
        codigos: [
            { aseguradoraId: "atm", codigo: "14341" }
        ]
    },
    {
        nombre: "GUERRERO",
        matricula: "109722",
        codigos: [
            { aseguradoraId: "atm", codigo: "14634" },
            { aseguradoraId: "mercantil-andina", codigo: "17670" },
            { aseguradoraId: "rio-uruguay", codigo: "17276" }
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