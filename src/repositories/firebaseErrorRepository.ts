import {
    Firestore,
    Timestamp
} from "firebase-admin/firestore";

import { ErrorSincronizacion } from "../models/errorSincronizacion";
import { FirebaseConfig } from "../config/firebaseConfig";

export class FirestoreErrorRepository {

    private readonly COLLECTION_NAME = "errores";

    private readonly firestore: Firestore;

    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }

    async guardar(error: ErrorSincronizacion): Promise<string> {
    
        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc();
    
        const datos = {
            ...error,
            fecha: Timestamp.now()
        };
    
        if (datos.detalle === undefined) {
            delete datos.detalle;
        }
    
        await referencia.set(datos);
    
        return referencia.id;
    }
}