"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseConfig = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const rootPath = path_1.default.resolve(__dirname, "../..");
// Cargar variables locales cuando exista .env
dotenv_1.default.config({
    path: path_1.default.join(rootPath, ".env")
});
// Resolver credenciales locales relativas al proyecto
const credentialsPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
if (credentialsPath && !path_1.default.isAbsolute(credentialsPath)) {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] =
        path_1.default.resolve(rootPath, credentialsPath);
}
class FirebaseConfig {
    static firestore = null;
    static getFirestore() {
        if (this.firestore) {
            return this.firestore;
        }
        if ((0, app_1.getApps)().length === 0) {
            (0, app_1.initializeApp)({
                credential: (0, app_1.applicationDefault)()
            });
        }
        this.firestore = (0, firestore_1.getFirestore)();
        return this.firestore;
    }
}
exports.FirebaseConfig = FirebaseConfig;
//# sourceMappingURL=firebaseConfig.js.map