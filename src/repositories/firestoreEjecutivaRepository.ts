import { Firestore } from "firebase-admin/firestore";

import { FirebaseConfig } from "../config/firebaseConfig";
import { Ejecutiva } from "../models/ejecutiva";


/**
 * Repository encargado del acceso a la colección
 * de ejecutivas almacenada en Firestore.
 */
export class FirestoreEjecutivaRepository {

    /**
     * Nombre de la colección donde se almacenan
     * las ejecutivas.
     */
    private readonly COLLECTION_NAME = "ejecutivas";

    /**
     * Instancia de Firestore utilizada
     * para realizar las operaciones.
     */
    private readonly firestore: Firestore;


    /**
     * Inicializa el repository y obtiene
     * la instancia de Firestore.
     */
    constructor() {

        this.firestore = FirebaseConfig.getFirestore();
    }


    /**
     * Guarda o actualiza una ejecutiva.
     *
     * El ID definido en la propia ejecutiva se utiliza
     * como ID del documento en Firestore.
     *
     * Ejemplo:
     *
     * ejecutivas/andrea-collia
     *
     * @param ejecutiva ejecutiva que se desea guardar.
     */
    async guardar(ejecutiva: Ejecutiva): Promise<void> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(ejecutiva.id);

        await referencia.set(ejecutiva,
            {
                merge: true
            }
        );
    }


    /**
     * Obtiene una ejecutiva mediante su identificador.
     *
     * @param id identificador de la ejecutiva.
     * @returns ejecutiva encontrada o null si no existe.
     */
    async obtenerPorId(id: string): Promise<Ejecutiva | null> {

        const documento = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!documento.exists)
        return null;

        const datos = documento.data();

        if (!datos)
        return null;

        return datos as Ejecutiva;
    }

    /**
     * Obtiene únicamente las ejecutivas activas.
     */
    async obtenerActivas(): Promise<Ejecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME).where("activa", "==", true).get();

        return resultado.docs.map(
            documento =>
                documento.data() as Ejecutiva
        );
    }


    /**
     * Obtiene todas las ejecutivas
     * configuradas en Firestore.
     *
     * @returns listado completo de ejecutivas.
     */
    async obtenerTodas(): Promise<Ejecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME).get();

        return resultado.docs.map(documento =>
                documento.data() as Ejecutiva
        );
    }

    /**
     * Reactiva una ejecutiva previamente desactivada.
     *
     * @param id identificador de la ejecutiva.
     */
    async activar(id: string): Promise<void> {
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).update({activa: true });
    }


    /**
     * Realiza la baja lógica de una ejecutiva.
     *
     * La ejecutiva permanece almacenada en Firestore
     * para conservar su información y las referencias
     * históricas existentes.
     *
     * @param id identificador de la ejecutiva.
     */
    async desactivar(id: string): Promise<void> {
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).update({ activa: false });
    }
}