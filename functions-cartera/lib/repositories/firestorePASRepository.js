"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePASRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const pasValidator_1 = require("../validators/pasValidator");
class FirestorePASRepository {
    firestore;
    COLLECTION_NAME = "productores";
    constructor(firestore) {
        this.firestore = firestore;
    }
    /**
     * Obtiene todos los PAS registrados.
     */
    async obtenerTodos() {
        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).get();
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    }
    /**
     * Obtiene un PAS por su identificador.
     * Valida la estructura del documento recuperado de Firestore.
     */
    async obtenerPorId(id) {
        const doc = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();
        if (!doc.exists) {
            return null;
        }
        const datos = {
            ...doc.data(),
            id: doc.id
        };
        if (!(0, pasValidator_1.esPASValido)(datos)) {
            console.error(`Estructura inválida para el productor: ${doc.id}`);
            throw new Error("El documento del productor contiene datos inválidos");
        }
        return datos;
    }
    /**
     * Busca PAS por matrícula.
     *
     * Devuelve una lista porque durante la importación
     * podrían existir matrículas duplicadas.
     */
    async obtenerPorMatricula(matricula) {
        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).where("matricula", "==", matricula).get();
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    }
    /**
     * Crea un nuevo PAS.
     *
     * Firestore genera automáticamente un ID único.
     */
    async crear(pas) {
        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc();
        const { id, fechaCreacion, fechaActualizacion, ...datos } = pas;
        await referencia.create({
            ...datos,
            fechaCreacion: firestore_1.Timestamp.now(),
            fechaActualizacion: firestore_1.Timestamp.now()
        });
        return referencia.id;
    }
    /**
     * Incorpora nuevos PAS a una colección existente.
     *
     * Utiliza identificadores previamente definidos y una
     * operación atómica para evitar escrituras parciales.
     *
     * No permite sobrescribir documentos existentes.
     *
     * @param productores - Productores a incorporar.
     * @returns Cantidad de productores creados.
     */
    async incorporarProductores(productores) {
        if (productores.length === 0 || productores.length > 500) {
            throw new Error("Se requiere entre 1 y 500 productores.");
        }
        const ids = productores.map(productor => productor.id);
        if (ids.some(id => !id?.trim() || id.includes("/"))) {
            throw new Error("Se encontraron identificadores inválidos.");
        }
        if (new Set(ids).size !== ids.length) {
            throw new Error("Se encontraron identificadores duplicados.");
        }
        for (const productor of productores) {
            const id = productor.id;
            if (!(0, pasValidator_1.esPASValido)(productor)) {
                throw new Error(`Estructura inválida para el productor: ${id}`);
            }
        }
        const coleccion = this.firestore.collection(this.COLLECTION_NAME);
        const batch = this.firestore.batch();
        const fecha = firestore_1.Timestamp.now();
        for (const productor of productores) {
            const referencia = coleccion.doc(productor.id);
            const { id, fechaCreacion, fechaActualizacion, ...datos } = productor;
            batch.create(referencia, {
                ...datos,
                fechaCreacion: fecha,
                fechaActualizacion: fecha
            });
        }
        await batch.commit();
        return productores.length;
    }
    /**
     * Actualiza los datos de un PAS existente.
     *
     * No modifica su fecha de creación.
     */
    async actualizar(id, datos) {
        const { id: _id, fechaCreacion: _fechaCreacion, fechaActualizacion: _fechaActualizacion, ...campos } = datos;
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).update({
            ...campos,
            fechaActualizacion: firestore_1.Timestamp.now()
        });
    }
    /**
     * Obtiene todos los PAS asignados a una ejecutiva.
     */
    async obtenerPorEjecutiva(ejecutivaId) {
        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).where("ejecutivaId", "==", ejecutivaId).get();
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
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
    async importarInicial(productores) {
        const coleccion = this.firestore.collection(this.COLLECTION_NAME);
        // La importación inicial no debe modificar datos existentes.
        const existentes = await coleccion.limit(1).get();
        if (!existentes.empty) {
            throw new Error("La colección productores no está vacía. " +
                "Se canceló la importación para proteger los datos existentes.");
        }
        if (productores.length === 0 || productores.length > 500) {
            throw new Error("La importación requiere entre 1 y 500 productores.");
        }
        const ids = productores.map(productor => productor.id);
        if (ids.some(id => !id || id.includes("/"))) {
            throw new Error("Se encontraron identificadores inválidos.");
        }
        if (new Set(ids).size !== ids.length) {
            throw new Error("Se encontraron identificadores duplicados.");
        }
        const batch = this.firestore.batch();
        const fecha = firestore_1.Timestamp.now();
        for (const productor of productores) {
            const referencia = coleccion.doc(productor.id);
            const { id, fechaCreacion, fechaActualizacion, ...datos } = productor;
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
exports.FirestorePASRepository = FirestorePASRepository;
//# sourceMappingURL=firestorePASRepository.js.map