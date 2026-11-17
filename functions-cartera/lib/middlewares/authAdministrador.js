"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authAdministrador = void 0;
const auth_1 = require("firebase-admin/auth");
const firebaseConfig_1 = require("../config/firebaseConfig");
const authAdministrador = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
        res.status(401).json({
            error: "Token de autenticación requerido"
        });
        return;
    }
    const token = authorization.substring(7).trim();
    if (!token) {
        res.status(401).json({
            error: "Token de autenticación vacío"
        });
        return;
    }
    try {
        const firestore = firebaseConfig_1.FirebaseConfig.getFirestore();
        const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(token);
        const usuarioDoc = await firestore
            .collection("usuarios")
            .doc(decodedToken.uid)
            .get();
        if (!usuarioDoc.exists) {
            res.status(403).json({
                error: "Usuario no autorizado"
            });
            return;
        }
        const usuario = usuarioDoc.data();
        if (usuario?.role !== "Administrador") {
            res.status(403).json({
                error: "Acceso exclusivo para administradores"
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error("Error verificando autenticación:", error);
        res.status(401).json({
            error: "No se pudo validar la autenticación"
        });
    }
};
exports.authAdministrador = authAdministrador;
//# sourceMappingURL=authAdministrador.js.map