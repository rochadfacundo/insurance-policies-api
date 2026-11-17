
import { Router } from "express";
import { authAdministrador } from "../middlewares/authAdministrador";
import {
    obtenerProductores,
    obtenerProductorPorId
} from "../controllers/productoresController";

const router = Router();

// Todas las rutas requieren autenticación y rol Administrador
router.use(authAdministrador);

// GET /productores
router.get("/", obtenerProductores);

// GET /productores/:id
router.get("/:id", obtenerProductorPorId);

export default router;
