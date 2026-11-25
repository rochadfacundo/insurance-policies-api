import { Request, Response } from "express";
import { FirebaseConfig } from "../config/firebaseConfig";
import { FirestorePASRepository } from "../repositories/firestorePASRepository";
import { FirestorePolizaCarteraRepository } from "../repositories/firestorePolizaCarteraRepository";


// ==========================================
// OBTENER TODOS LOS PRODUCTORES
// ==========================================

export const obtenerProductores = async (
    _req: Request,
    res: Response
): Promise<void> => {

    try {

        const firestore = FirebaseConfig.getFirestore();

        const repository = new FirestorePASRepository(firestore);

        const productores = await repository.obtenerTodos();

        res.status(200).json({
            total: productores.length,
            productores
        });

    } catch (error) {

        console.error("Error obteniendo productores:", error);

        res.status(500).json({
            error: "No se pudieron obtener los productores"
        });
    }
};


// ==========================================
// OBTENER PRODUCTOR POR ID
// ==========================================

export const obtenerProductorPorId = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const { id } = req.params;

        if (typeof id !== "string" || !id.trim()) {

            res.status(400).json({
                error: "Identificador de productor inválido"
            });

            return;
        }

        const firestore = FirebaseConfig.getFirestore();

        const repository = new FirestorePASRepository(firestore);

        const productor = await repository.obtenerPorId(id);

        if (!productor) {

            res.status(404).json({
                error: "Productor no encontrado"
            });

            return;
        }

        res.status(200).json(productor);

    } catch (error) {

        console.error("Error obteniendo productor por ID:", error);

        res.status(500).json({
            error: "No se pudo obtener el productor"
        });
    }
};


// ==========================================
// OBTENER CARTERA DEL PRODUCTOR
// ==========================================

export const obtenerPolizasProductor = async (
    req: Request,
    res: Response
): Promise<void> => {

    try {

        const { id } = req.params;

        if (
            typeof id !== "string" ||
            !id.trim() ||
            id.includes("/")
        ) {

            res.status(400).json({
                error: "Identificador de productor inválido"
            });

            return;
        }

        const firestore = FirebaseConfig.getFirestore();

        const pasRepository = new FirestorePASRepository(
            firestore
        );

        const carteraRepository = new FirestorePolizaCarteraRepository(
            firestore
        );

        // Verificar que el productor exista.
        const productor = await pasRepository.obtenerPorId(id);

        if (!productor) {

            res.status(404).json({
                error: "Productor no encontrado"
            });

            return;
        }

        // Obtener las pólizas asociadas al PAS.
        const polizas = await carteraRepository.obtenerPorPAS(id);

        res.status(200).json({
            pasId: id,
            total: polizas.length,
            polizas
        });

    } catch (error) {

        console.error(
            "Error obteniendo cartera del productor:",
            error
        );

        res.status(500).json({
            error: "No se pudo obtener la cartera del productor"
        });
    }
};