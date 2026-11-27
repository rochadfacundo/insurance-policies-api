import * as dotenv from "dotenv";

dotenv.config({ path: ".env.scripts.backup" });
dotenv.config();

import { FirebaseConfig } from "../src/config/firebaseConfig";
import { FirestorePASRepository } from "../src/repositories/firestorePASRepository";
import { PAS } from "../src/models/pas";
import { CodigoAseguradora } from "../src/models/aseguradora";
import { esPASValido } from "../src/validators/pasValidator";

interface ProductorMigracion {
    nombre: string;
    matricula: string;
    filaOrigen: number;
    companias: CodigoAseguradora[];
}

interface OrganizacionMigracion {
    nombre: string;
    organizadorId: string;
    matriculaOrganizador: string;
    productores: ProductorMigracion[];
}

const APLICAR = process.argv.includes("--aplicar");

// ========================================
// CONFIGURACIÓN DE LA ORGANIZACIÓN
// ========================================

const ORGANIZACION: OrganizacionMigracion = {
    nombre: "BAGALA",
    organizadorId: "excel-mat-72416",
    matriculaOrganizador: "72416",

    productores: [
        {
            nombre: "BULACIO FERNANDO GABRIEL",
            matricula: "109143",
            filaOrigen: 2,
            companias: [
                {
                    aseguradoraId: "atm",
                    codigos: ["14235"],
                    estado: "PROPIO"
                },
                {
                    aseguradoraId: "mercantil-andina",
                    codigos: ["17238"],
                    estado: "PROPIO"
                },
                {
                    aseguradoraId: "rio-uruguay",
                    codigos: ["17243"],
                    estado: "PROPIO"
                }
            ]
        },
        {
            nombre: "PETROSILLO JUAN",
            matricula: "72392",
            filaOrigen: 3,
            companias: [
                {
                    aseguradoraId: "atm",
                    codigos: ["14341"],
                    estado: "PROPIO"
                }
            ]
        },
        {
            nombre: "GUERRERO DIEGO ISMAEL",
            matricula: "109722",
            filaOrigen: 4,
            companias: [
                {
                    aseguradoraId: "atm",
                    codigos: ["14634"],
                    estado: "PROPIO"
                },
                {
                    aseguradoraId: "mercantil-andina",
                    codigos: ["17670"],
                    estado: "PROPIO"
                },
                {
                    aseguradoraId: "rio-uruguay",
                    codigos: ["17276"],
                    estado: "PROPIO"
                }
            ]
        }
    ]
};

// ========================================
// FUNCIONES AUXILIARES
// ========================================

function normalizarNombre(nombre: string): string {

    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .split(/\s+/)
        .sort()
        .join(" ");
}

function crearPAS(
    productor: ProductorMigracion,
    organizacion: OrganizacionMigracion
): PAS {

    return {
        id: `excel-mat-${productor.matricula}`,
        nombre: productor.nombre,
        matricula: productor.matricula,

        estado: "ACTIVO",
        clasificacion: null,
        vinculo: organizacion.nombre,
        actividadPrincipal: null,

        tieneRC: null,
        estadoRC: "DESCONOCIDO",

        ejecutivaId: null,

        contacto: {},

        companias: productor.companias,
        otrasCompanias: [],

        particularidades:
            `Importado desde la hoja PAS ${organizacion.nombre}.`,

        productorSuperiorId: organizacion.organizadorId,
        tipoGestion: "GESTIONADO_POR_ORGANIZADOR",

        origen: "EXCEL",
        filaOrigen: productor.filaOrigen
    };
}

// ========================================
// VALIDACIÓN DE LA MIGRACIÓN
// ========================================

function validarMigracion(
    nuevos: PAS[],
    existentes: PAS[],
    organizacion: OrganizacionMigracion
): string[] {

    const errores: string[] = [];

    const organizador = existentes.find(
        pas => pas.id === organizacion.organizadorId
    );

    if (!organizador) {

        errores.push("El organizador no existe.");

    } else {

        if (organizador.estado !== "ACTIVO") {
            errores.push("El organizador no está activo.");
        }

        if (
            organizador.matricula !==
            organizacion.matriculaOrganizador
        ) {
            errores.push("La matrícula del organizador no coincide.");
        }

        // Por ahora migramos organizaciones de un solo nivel.
        if (organizador.productorSuperiorId) {
            errores.push(
                "El organizador depende de otro productor."
            );
        }
    }

    const ids = new Set(
        existentes.map(pas => pas.id)
    );

    const matriculas = new Set(
        existentes
            .filter(pas => pas.matricula !== null)
            .map(pas => pas.matricula)
    );

    const nombres = new Set(
        existentes.map(pas => normalizarNombre(pas.nombre))
    );

    const codigos = new Map<string, string>();

    for (const pas of existentes) {

        for (const compania of pas.companias) {

            for (const codigo of compania.codigos) {

                const clave =
                    `${compania.aseguradoraId}:${codigo.trim()}`;

                codigos.set(clave, pas.id);
            }
        }
    }

    for (const pas of nuevos) {

        const id = pas.id;

        if (!esPASValido(pas)) {
            errores.push(`Estructura inválida: ${id}`);
            continue;
        }

        if (ids.has(pas.id)) {
            errores.push(`ID duplicado: ${pas.id}`);
        }

        ids.add(pas.id);

        if (!pas.matricula) {

            errores.push(`Matrícula ausente: ${pas.id}`);

        } else {

            if (matriculas.has(pas.matricula)) {
                errores.push(
                    `Matrícula duplicada: ${pas.matricula}`
                );
            }

            matriculas.add(pas.matricula);
        }

        const nombre = normalizarNombre(pas.nombre);

        if (nombres.has(nombre)) {
            errores.push(
                `Nombre coincidente: ${pas.nombre}`
            );
        }

        nombres.add(nombre);

        for (const compania of pas.companias) {

            for (const codigo of compania.codigos) {

                const clave =
                    `${compania.aseguradoraId}:${codigo.trim()}`;

                const titular = codigos.get(clave);

                if (titular) {

                    errores.push(
                        `Código duplicado: ${clave}. ` +
                        `Titular existente: ${titular}`
                    );

                } else {

                    codigos.set(clave, pas.id);
                }
            }
        }
    }

    return errores;
}

// ========================================
// EJECUCIÓN
// ========================================

async function main(): Promise<void> {

    console.log("========================================");
    console.log("MIGRACIÓN DE ORGANIZACIÓN PAS");
    console.log(`Organización: ${ORGANIZACION.nombre}`);
    console.log(APLICAR ? "MODO APLICAR" : "MODO SIMULACIÓN");
    console.log("========================================");

    const firestore = FirebaseConfig.getFirestore();
    const repository = new FirestorePASRepository(firestore);

    const existentes = await repository.obtenerTodos();

    const nuevos = ORGANIZACION.productores.map(
        productor => crearPAS(productor, ORGANIZACION)
    );

    const errores = validarMigracion(
        nuevos,
        existentes,
        ORGANIZACION
    );

    const organizador = existentes.find(
        pas => pas.id === ORGANIZACION.organizadorId
    );

    console.log("\nORGANIZADOR:");

    console.table({
        id: organizador?.id,
        nombre: organizador?.nombre,
        matricula: organizador?.matricula,
        ejecutivaId: organizador?.ejecutivaId,
        estado: organizador?.estado
    });

    console.log("\nPRODUCTORES A INCORPORAR:");

    console.table(
        nuevos.map(pas => ({
            id: pas.id,
            nombre: pas.nombre,
            matricula: pas.matricula,
            estado: pas.estado,
            vinculo: pas.vinculo,
            ejecutivaId: pas.ejecutivaId,
            tipoGestion: pas.tipoGestion,
            productorSuperiorId: pas.productorSuperiorId
        }))
    );

    console.log("\nCÓDIGOS A INCORPORAR:");

    console.table(
        nuevos.flatMap(pas =>
            pas.companias.flatMap(compania =>
                compania.codigos.map(codigo => ({
                    productor: pas.nombre,
                    aseguradora: compania.aseguradoraId,
                    codigo,
                    estado: compania.estado
                }))
            )
        )
    );

    console.log("\nRESUMEN:");

    console.table({
        productoresActuales: existentes.length,
        productoresNuevos: nuevos.length,
        totalProyectado: existentes.length + nuevos.length,
        errores: errores.length
    });

    if (errores.length > 0) {

        console.table(errores);

        throw new Error(
            "Migración cancelada. No se realizaron escrituras."
        );
    }

    if (!APLICAR) {

        console.log("\nSIMULACIÓN FINALIZADA.");
        console.log("No se realizaron escrituras en Firestore.");

        return;
    }

    const incorporados = await repository.incorporarProductores(
        nuevos
    );

    console.log("\nMIGRACIÓN FINALIZADA.");
    console.log(`Productores incorporados: ${incorporados}`);
}

main().catch(error => {
    console.error("\nERROR:", error);
    process.exitCode = 1;
});