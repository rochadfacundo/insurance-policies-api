"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerProductorPorId = exports.obtenerProductores = void 0;
const firebaseConfig_1 = require("../config/firebaseConfig");
const firestorePASRepository_1 = require("../repositories/firestorePASRepository");
const obtenerProductores = async (_req, res) => {
    try {
        const firestore = firebaseConfig_1.FirebaseConfig.getFirestore();
        const repository = new firestorePASRepository_1.FirestorePASRepository(firestore);
        const productores = await repository.obtenerTodos();
        res.status(200).json({
            total: productores.length,
            productores
        });
    }
    catch (error) {
        console.error("Error obteniendo productores:", error);
        res.status(500).json({
            error: "No se pudieron obtener los productores"
        });
    }
};
exports.obtenerProductores = obtenerProductores;
const obtenerProductorPorId = async (req, res) => {
    try {
        const { id } = req.params;
        if (typeof id !== "string" || !id.trim()) {
            res.status(400).json({
                error: "Identificador de productor inválido"
            });
            return;
        }
        const firestore = firebaseConfig_1.FirebaseConfig.getFirestore();
        const repository = new firestorePASRepository_1.FirestorePASRepository(firestore);
        const productor = await repository.obtenerPorId(id);
        if (!productor) {
            res.status(404).json({
                error: "Productor no encontrado"
            });
            return;
        }
        res.status(200).json(productor);
    }
    catch (error) {
        console.error("Error obteniendo productor por ID:", error);
        res.status(500).json({
            error: "No se pudo obtener el productor"
        });
    }
};
exports.obtenerProductorPorId = obtenerProductorPorId;
//# sourceMappingURL=productoresController.js.map