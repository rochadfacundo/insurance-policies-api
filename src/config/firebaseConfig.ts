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

dotenv.config({
    path: path.join(rootPath, ".env")
});

const credentialsPath =
    process.env["GOOGLE_APPLICATION_CREDENTIALS"];

if (credentialsPath) {
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] =
        path.resolve(rootPath, credentialsPath);
}

export class FirebaseConfig {

    private static firestore: Firestore | null = null;

    static getFirestore(): Firestore {

        if (this.firestore) {
            return this.firestore;
        }

        const projectId = process.env["FIREBASE_PROJECT_ID"];

        if (!projectId) {
            throw new Error("Falta la variable FIREBASE_PROJECT_ID en el archivo .env");
        }


        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault(), projectId });
        }

        this.firestore = getFirestore();

        return this.firestore;
    }
}