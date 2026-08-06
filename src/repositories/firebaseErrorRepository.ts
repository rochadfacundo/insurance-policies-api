import {
    Firestore,
    Timestamp
} from "firebase-admin/firestore";

import { ErrorSincronizacion } from "../models/errorSincronizacion";
import { FirebaseConfig } from "../config/firebaseConfig";

export class FirestoreErrorRepository {

    /**
     * Atributos privados de la clase FirestoreErrorRepository.
     * Colección de Firestore donde se almacenan los errores de sincronización y la instancia de Firestore.
     * COLLECTION_NAME: Nombre de la colección de Firestore donde se almacenan los errores de sincronización.
     * firestore: Instancia de Firestore utilizada para interactuar con la base de datos. 
     */
    private readonly COLLECTION_NAME = "errores";
    private readonly firestore: Firestore;

    /**
     * Crea una instancia de FirestoreErrorRepository y establece la conexión con Firestore. 
     */
    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }

    /**
     * Método para guardar un error de sincronización en Firestore. 
     * @param error objeto de tipo ErrorSincronizacion que contiene la información del error a guardar. 
     * @returns una promesa que resuelve con el ID del documento creado en Firestore. 
     */
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