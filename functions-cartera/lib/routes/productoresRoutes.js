"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authAdministrador_1 = require("../middlewares/authAdministrador");
const productoresController_1 = require("../controllers/productoresController");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación y rol Administrador
router.use(authAdministrador_1.authAdministrador);
// GET /productores
router.get("/", productoresController_1.obtenerProductores);
// GET /productores/:id
router.get("/:id", productoresController_1.obtenerProductorPorId);
exports.default = router;
//# sourceMappingURL=productoresRoutes.js.map