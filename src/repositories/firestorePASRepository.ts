
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { PAS } from "../models/pas";

export class FirestorePASRepository {

    private readonly COLLECTION_NAME = "productores";

    constructor(private readonly firestore: Firestore) {}

    /**
     * Obtiene todos los PAS registrados.
     */
    async obtenerTodos(): Promise<PAS[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).get();

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as PAS));
    }

    /**
     * Obtiene un PAS por su identificador.
     */
    async obtenerPorId(id: string): Promise<PAS | null> {

        const doc = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!doc.exists) {
            return null;
        }

        return {
            ...doc.data(),
            id: doc.id
        } as PAS;
    }

    /**
     * Busca PAS por matrícula.
     *
     * Devuelve una lista porque durante la importación
     * podrían existir matrículas duplicadas.
     */
    async obtenerPorMatricula(matricula: string): Promise<PAS[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).where("matricula", "==", matricula).get();

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as PAS));
    }

    /**
     * Crea un nuevo PAS.
     *
     * Firestore genera automáticamente un ID único.
     */
    async crear(pas: PAS): Promise<string> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc();

        const { id, fechaCreacion, fechaActualizacion, ...datos } = pas;

        await referencia.create({
            ...datos,
            fechaCreacion: Timestamp.now(),
            fechaActualizacion: Timestamp.now()
        });

        return referencia.id;
    }

    /**
     * Actualiza los datos de un PAS existente.
     *
     * No modifica su fecha de creación.
     */
    async actualizar(id: string, datos: Partial<PAS>): Promise<void> {

        const {
            id: _id,
            fechaCreacion: _fechaCreacion,
            fechaActualizacion: _fechaActualizacion,
            ...campos
        } = datos;

        await this.firestore.collection(this.COLLECTION_NAME).doc(id).update({
                ...campos,
                fechaActualizacion: Timestamp.now()
            });
    }

    /**
     * Obtiene todos los PAS asignados a una ejecutiva.
     */
    async obtenerPorEjecutiva(ejecutivaId: string): Promise<PAS[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).where("ejecutivaId", "==", ejecutivaId).get();

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as PAS));
    }

    /**
 * Importa un conjunto de PAS mediante una operación atómica.
 *
 * Requiere que la colección de destino esté vacía.
 * Utiliza identificadores estables para evitar duplicaciones
 * ante ejecuciones repetidas del importador.
 *
 * Si alguna creación falla, no se confirma el lote.
 *
 * @param productores - PAS previamente validados.
 * @returns Cantidad de documentos creados.
 */
async importarInicial(productores: PAS[]): Promise<number> {

    const coleccion = this.firestore.collection(this.COLLECTION_NAME);

    // La importación inicial no debe modificar datos existentes.
    const existentes = await coleccion.limit(1).get();

    if (!existentes.empty) {
        throw new Error(
            "La colección productores no está vacía. " +
            "Se canceló la importación para proteger los datos existentes."
        );
    }

    if (productores.length === 0 || productores.length > 500) {
        throw new Error(
            "La importación requiere entre 1 y 500 productores."
        );
    }

    const ids = productores.map(productor => productor.id);

    if (ids.some(id => !id || id.includes("/"))) {
        throw new Error("Se encontraron identificadores inválidos.");
    }

    if (new Set(ids).size !== ids.length) {
        throw new Error("Se encontraron identificadores duplicados.");
    }

    const batch = this.firestore.batch();
    const fecha = Timestamp.now();

    for (const productor of productores) {

        const referencia = coleccion.doc(productor.id);

        const {
            id,
            fechaCreacion,
            fechaActualizacion,
            ...datos
        } = productor;

        batch.create(referencia, {
            ...datos,
            fechaCreacion: fecha,
            fechaActualizacion: fecha
        });
    }

    await batch.commit();

    return productores.length;
}
}
