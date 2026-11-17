
import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { FirebaseConfig } from "../config/firebaseConfig";

export const authAdministrador = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {

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
        const firestore = FirebaseConfig.getFirestore();

        const decodedToken = await getAuth().verifyIdToken(token);

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

    } catch (error) {
        console.error("Error verificando autenticación:", error);

        res.status(401).json({
            error: "No se pudo validar la autenticación"
        });
    }
};
