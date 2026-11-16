
import { Firestore } from "firebase-admin/firestore";
import { Aseguradora } from "../models/aseguradora";

export class FirestoreAseguradoraRepository {

    private readonly COLLECTION_NAME = "aseguradoras";

    constructor(private readonly firestore: Firestore) {}

    /**
     * Obtiene todas las aseguradoras registradas.
     */
    async obtenerTodas(): Promise<Aseguradora[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).get();

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as Aseguradora));
    }

    /**
     * Obtiene una aseguradora por su identificador.
     */
    async obtenerPorId(id: string): Promise<Aseguradora | null> {

        const doc = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!doc.exists) {
            return null;
        }

        return {
            ...doc.data(),
            id: doc.id
        } as Aseguradora;
    }

    /**
     * Registra una aseguradora.
     *
     * Utiliza un ID definido por nosotros para
     * evitar duplicados durante las importaciones.
     */
    async crear(aseguradora: Aseguradora): Promise<void> {

        const { id, ...datos } = aseguradora;

        await this.firestore.collection(this.COLLECTION_NAME).doc(id).create(datos);
    }

    /**
     * Actualiza una aseguradora existente.
     */
    async actualizar(
        id: string,
        datos: Partial<Aseguradora>
    ): Promise<void> {

        const { id: _id, ...campos } = datos;

        await this.firestore.collection(this.COLLECTION_NAME).doc(id).update(campos);
    }

    /**
     * Obtiene las aseguradoras activas.
     */
    async obtenerActivas(): Promise<Aseguradora[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).where("activa", "==", true).get();

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as Aseguradora));
    }
}
