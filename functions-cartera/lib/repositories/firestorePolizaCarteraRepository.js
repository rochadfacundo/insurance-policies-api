"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePolizaCarteraRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestorePolizaCarteraRepository {
    firestore;
    COLLECTION_NAME = "carteraPolizas";
    BATCH_SIZE = 400;
    constructor(firestore) {
        this.firestore = firestore;
    }
    // ==========================================
    // GUARDADO
    // ==========================================
    /**
     * Crea o actualiza una póliza de cartera.
     */
    async guardar(poliza) {
        await this.guardarMuchas([poliza]);
    }
    /**
     * Crea o actualiza múltiples pólizas utilizando batches.
     *
     * Conserva la fecha de creación de los documentos existentes.
     * No elimina pólizas.
     */
    async guardarMuchas(polizas) {
        if (polizas.length === 0) {
            return;
        }
        const coleccion = this.firestore.collection(this.COLLECTION_NAME);
        // Evitar escrituras duplicadas dentro de una ejecución.
        const ids = new Set();
        for (const poliza of polizas) {
            if (!poliza.id?.trim()) {
                throw new Error("La póliza no tiene un ID válido.");
            }
            if (ids.has(poliza.id)) {
                throw new Error(`Póliza duplicada en el lote: ${poliza.id}`);
            }
            ids.add(poliza.id);
        }
        for (let i = 0; i < polizas.length; i += this.BATCH_SIZE) {
            const lote = polizas.slice(i, i + this.BATCH_SIZE);
            const referencias = lote.map(poliza => coleccion.doc(poliza.id));
            const existentes = await this.firestore.getAll(...referencias);
            const indiceExistentes = new Map(existentes.map(doc => [doc.id, doc]));
            const batch = this.firestore.batch();
            for (const poliza of lote) {
                const referencia = coleccion.doc(poliza.id);
                const existente = indiceExistentes.get(poliza.id);
                const datos = this.eliminarUndefined({
                    ...poliza
                });
                const fechaCreacion = existente?.get("fechaCreacion") ??
                    firestore_1.FieldValue.serverTimestamp();
                batch.set(referencia, {
                    ...datos,
                    fechaCreacion,
                    fechaActualizacion: firestore_1.FieldValue.serverTimestamp()
                });
            }
            await batch.commit();
        }
    }
    // ==========================================
    // CONSULTAS
    // ==========================================
    /**
     * Obtiene una póliza por su identificador interno.
     */
    async obtenerPorId(id) {
        const documento = await this.firestore
            .collection(this.COLLECTION_NAME)
            .doc(id)
            .get();
        if (!documento.exists) {
            return null;
        }
        return this.mapearDocumento(documento);
    }
    /**
     * Obtiene todas las pólizas asociadas a un PAS.
     *
     * Permite filtrar opcionalmente por compañía.
     */
    async obtenerPorPAS(pasId, compania) {
        let consulta = this.firestore
            .collection(this.COLLECTION_NAME)
            .where("pasId", "==", pasId);
        if (compania !== undefined) {
            consulta = consulta.where("compania", "==", compania);
        }
        const snapshot = await consulta.get();
        return snapshot.docs.map(doc => this.mapearDocumento(doc));
    }
    /**
     * Obtiene las pólizas correspondientes a una compañía.
     */
    async obtenerPorCompania(compania) {
        const snapshot = await this.firestore
            .collection(this.COLLECTION_NAME)
            .where("compania", "==", compania)
            .get();
        return snapshot.docs.map(doc => this.mapearDocumento(doc));
    }
    /**
     * Obtiene las pólizas de un código comercial específico.
     *
     * El código siempre se consulta junto con la compañía,
     * porque puede repetirse entre aseguradoras.
     */
    async obtenerPorProductor(compania, codigo) {
        const snapshot = await this.firestore
            .collection(this.COLLECTION_NAME)
            .where("compania", "==", compania)
            .where("productor.codigo", "==", codigo)
            .get();
        return snapshot.docs.map(doc => this.mapearDocumento(doc));
    }
    /**
     * Obtiene las pólizas pendientes de asociación a un PAS.
     */
    async obtenerSinAsociar(compania) {
        let consulta = this.firestore
            .collection(this.COLLECTION_NAME)
            .where("pasId", "==", null);
        if (compania !== undefined) {
            consulta = consulta.where("compania", "==", compania);
        }
        const snapshot = await consulta.get();
        return snapshot.docs.map(doc => this.mapearDocumento(doc));
    }
    // ==========================================
    // MAPEO FIRESTORE
    // ==========================================
    /**
     * Convierte un documento Firestore al modelo de dominio.
     */
    mapearDocumento(documento) {
        const datos = documento.data();
        if (!datos) {
            throw new Error(`Documento de cartera vacío: ${documento.id}`);
        }
        return {
            ...datos,
            id: documento.id,
            moneda: datos.moneda ?? null,
            facturacion: {
                desde: this.convertirFecha(datos.facturacion?.desde),
                hasta: this.convertirFecha(datos.facturacion?.hasta)
            },
            finVigencia: datos.finVigencia === null
                ? null
                : this.convertirFecha(datos.finVigencia),
            fechaCreacion: datos.fechaCreacion != null
                ? this.convertirFecha(datos.fechaCreacion)
                : undefined,
            fechaActualizacion: datos.fechaActualizacion != null
                ? this.convertirFecha(datos.fechaActualizacion)
                : undefined
        };
    }
    /**
     * Convierte Timestamp de Firestore a Date.
     */
    convertirFecha(valor) {
        if (valor instanceof firestore_1.Timestamp) {
            return valor.toDate();
        }
        if (valor instanceof Date &&
            Number.isFinite(valor.getTime())) {
            return valor;
        }
        throw new Error(`Fecha inválida en documento de cartera: ${valor}`);
    }
    /**
     * Elimina propiedades undefined recursivamente.
     *
     * Conserva null, Date y Timestamp.
     */
    eliminarUndefined(objeto) {
        const resultado = {};
        for (const [clave, valor] of Object.entries(objeto)) {
            if (valor === undefined) {
                continue;
            }
            if (valor !== null &&
                typeof valor === "object" &&
                !Array.isArray(valor) &&
                !(valor instanceof Date) &&
                !(valor instanceof firestore_1.Timestamp)) {
                resultado[clave] = this.eliminarUndefined(valor);
            }
            else {
                resultado[clave] = valor;
            }
        }
        return resultado;
    }
}
exports.FirestorePolizaCarteraRepository = FirestorePolizaCarteraRepository;
//# sourceMappingURL=firestorePolizaCarteraRepository.js.map