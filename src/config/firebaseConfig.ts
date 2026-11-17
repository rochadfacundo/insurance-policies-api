
import {
    applicationDefault,
    getApps,
    initializeApp
} from "firebase-admin/app";

import {
    Firestore,
    getFirestore
} from "firebase-admin/firestore";

import path from "path";
import dotenv from "dotenv";

const rootPath = path.resolve(__dirname, "../..");

// Cargar variables locales cuando exista .env
dotenv.config({
    path: path.join(rootPath, ".env")
});

// Resolver credenciales locales relativas al proyecto
const credentialsPath =
    process.env["GOOGLE_APPLICATION_CREDENTIALS"];

if (credentialsPath && !path.isAbsolute(credentialsPath)) {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] =
        path.resolve(rootPath, credentialsPath);
}

export class FirebaseConfig {

    private static firestore: Firestore | null = null;

    static getFirestore(): Firestore {

        if (this.firestore) {
            return this.firestore;
        }

        if (getApps().length === 0) {
            initializeApp({
                credential: applicationDefault()
            });
        }

        this.firestore = getFirestore();

        return this.firestore;
    }
}
