"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiCartera = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = __importDefault(require("./app"));
exports.apiCartera = (0, https_1.onRequest)({
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 10,
    cors: [
        "http://localhost:4200",
        "https://tecnicayservicios.com.ar",
        "https://www.tecnicayservicios.com.ar",
    ]
}, app_1.default);
//# sourceMappingURL=index.js.map