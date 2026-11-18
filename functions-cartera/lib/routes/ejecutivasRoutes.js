"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authAdministrador_1 = require("../middlewares/authAdministrador");
const ejecutivasController_1 = require("../controllers/ejecutivasController");
const router = (0, express_1.Router)();
router.use(authAdministrador_1.authAdministrador);
// GET /ejecutivas/:id
router.get("/:id", ejecutivasController_1.obtenerEjecutivaPorId);
exports.default = router;
//# sourceMappingURL=ejecutivasRoutes.js.map