import { Firestore } from "firebase-admin/firestore";

import { FirebaseConfig } from "../config/firebaseConfig";
import { ProductorEjecutiva } from "../models/productorEjecutiva";

export class FirestoreProductorEjecutivaRepository {

    /**
     * Nombre de la colección donde se almacena
     * la relación entre productores y ejecutivas.
     */
    private readonly COLLECTION_NAME = "productoresEjecutivas";

    /**
     * Instancia de Firestore.
     */
    private readonly firestore: Firestore;


    /**
     * Crea una instancia del repository
     * y establece la conexión con Firestore.
     */
    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }


    /**
     * Guarda o actualiza la relación entre
     * un productor y una ejecutiva.
     *
     * Se utiliza el código del productor
     * como ID del documento.
     *
     * @param productorEjecutiva relación productor-ejecutiva a guardar.
     */
    async guardar(productorEjecutiva: ProductorEjecutiva): Promise<void> {

        const id = productorEjecutiva.productor.codigo.toString();

        const referencia =this.firestore.collection(this.COLLECTION_NAME).doc(id);

        await referencia.set(productorEjecutiva,
            {
                merge: true
            }
        );
    }


    /**
     * Obtiene la relación productor-ejecutiva
     * a partir del código del productor.
     *
     * @param codigoProductor código del productor.
     * @returns la relación encontrada o null.
     */
    async obtenerPorCodigoProductor(codigoProductor: number): Promise<ProductorEjecutiva | null> {

        const documento =
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(codigoProductor.toString())
                .get();

        if (!documento.exists) {
            return null;
        }

        const datos = documento.data();

        if (!datos) {
            return null;
        }

        return datos as ProductorEjecutiva;
    }


    /**
     * Obtiene todas las relaciones
     * entre productores y ejecutivas.
     */
    async obtenerTodos(): Promise<ProductorEjecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME).get();

        return resultado.docs.map(documento => documento.data() as ProductorEjecutiva);
    }


    /**
     * Obtiene todos los productores
     * asociados a una ejecutiva.
     *
     * @param idEjecutiva identificador de la ejecutiva.
     */
    async obtenerPorEjecutiva(idEjecutiva: string): Promise<ProductorEjecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME)
                .where("ejecutiva.id","==",idEjecutiva).get();

        return resultado.docs.map(documento => documento.data() as ProductorEjecutiva);
    }


    /**
     * Elimina la relación asociada
     * a un productor.
     *
     * @param codigoProductor código del productor.
     */
    async eliminar(codigoProductor: number): Promise<void> {

        await this.firestore.collection(this.COLLECTION_NAME).doc(codigoProductor.toString()).delete();
    }
}