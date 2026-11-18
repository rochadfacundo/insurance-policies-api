import { Router } from "express";
import { authAdministrador } from "../middlewares/authAdministrador";
import { obtenerEjecutivaPorId } from "../controllers/ejecutivasController";

const router = Router();

router.use(authAdministrador);

// GET /ejecutivas/:id
router.get("/:id", obtenerEjecutivaPorId);

export default router;