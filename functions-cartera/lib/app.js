"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productoresRoutes_1 = __importDefault(require("./routes/productoresRoutes"));
const ejecutivasRoutes_1 = __importDefault(require("./routes/ejecutivasRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Endpoint público de salud
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "OK",
        servicio: "apiCartera"
    });
});
// Endpoints protegidos de productores
app.use("/productores", productoresRoutes_1.default);
// Endpoints protegidos de ejecutivas
app.use("/ejecutivas", ejecutivasRoutes_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map