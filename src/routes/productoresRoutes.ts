import { Router } from "express";
import { authAdministrador } from "../middlewares/authAdministrador";

import {
    obtenerProductores,
    obtenerProductorPorId,
    obtenerPolizasProductor
} from "../controllers/productoresController";

const router = Router();

// Todas las rutas requieren autenticación y rol Administrador.
router.use(authAdministrador);

// GET /productores
router.get("/", obtenerProductores);

// GET /productores/:id/polizas
router.get("/:id/polizas", obtenerPolizasProductor);

// GET /productores/:id
router.get("/:id", obtenerProductorPorId);

export default router;