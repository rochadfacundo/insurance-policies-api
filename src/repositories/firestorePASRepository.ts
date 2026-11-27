
import { Firestore, Timestamp } from "firebase-admin/firestore";
import { PAS } from "../models/pas";
import { esPASValido } from "../validators/pasValidator";
import { PASVersionado, PlanMigracionPAS, ResultadoMigracionPAS } from "../models/migracionPAS";


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
     * Obtiene todos los productores junto con la versión
     * de sus documentos en Firestore.
     *
     * La versión corresponde al instante de la última
     * modificación registrada por Firestore, no al campo
     * fechaActualizacion administrado por la aplicación.
     *
     * Se utiliza para detectar modificaciones concurrentes
     * entre la planificación y la aplicación de una migración.
     *
     * @returns Productores y versiones de sus documentos.
     */
    async obtenerTodosVersionados(): Promise<PASVersionado[]> {

        const snapshot = await this.firestore.collection(this.COLLECTION_NAME).get();

        return snapshot.docs.map(doc => {

            const productor: unknown = {
                ...doc.data(),
                id: doc.id
            };

            if (!esPASValido(productor)) {

                throw new Error(
                    `Estructura inválida para el productor: ${doc.id}`
                );
            }

            return {
                productor,
                version: doc.updateTime
            };
        });
    }

    /**
     * Obtiene un PAS por su identificador.
     * Valida la estructura del documento recuperado de Firestore.
     */
    async obtenerPorId(id: string): Promise<PAS | null> {

        const doc = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!doc.exists) {
            return null;
        }

        const datos: unknown = {
            ...doc.data(),
            id: doc.id
        };

        if (!esPASValido(datos)) {
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
    async incorporarProductores(productores: PAS[]): Promise<number> {

        if (productores.length === 0 || productores.length > 500) {
            throw new Error(
                "Se requiere entre 1 y 500 productores."
            );
        }

        const ids = productores.map(productor => productor.id);

        if (ids.some(id => !id?.trim() || id.includes("/"))) {
            throw new Error(
                "Se encontraron identificadores inválidos."
            );
        }

        if (new Set(ids).size !== ids.length) {
            throw new Error(
                "Se encontraron identificadores duplicados."
            );
        }

        for (const productor of productores) {

            const id = productor.id;
        
            if (!esPASValido(productor)) {
                throw new Error(`Estructura inválida para el productor: ${id}`);
            }
        }

        const coleccion = this.firestore.collection(this.COLLECTION_NAME);
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




    /**
     * Aplica una migración de productores mediante una única
     * operación atómica de Firestore.
     *
     * Permite combinar altas y actualizaciones sin generar
     * escrituras parciales.
     *
     * Garantías:
     *
     * - Las altas no sobrescriben documentos existentes.
     * - Las actualizaciones requieren documentos existentes.
     * - Se valida la estructura final de los productores.
     * - No se modifica la fecha de creación de los PAS existentes.
     * - Se detectan modificaciones concurrentes mediante
     *   precondiciones sobre la versión de cada documento actualizado.
     *
     * Las reglas comerciales y las validaciones entre diferentes
     * productores deben ser verificadas durante la planificación.
     *
     * @param plan - Altas y actualizaciones previamente planificadas.
     * @returns Resultado de las operaciones confirmadas.
     * @throws Error si alguna validación o escritura falla.
     */
    async aplicarMigracion(plan: PlanMigracionPAS): Promise<ResultadoMigracionPAS> {

        const { altas, actualizaciones } = plan;

        const totalOperaciones = altas.length + actualizaciones.length;

        // ========================================================
        // VALIDACIÓN GENERAL DEL PLAN
        // ========================================================

        if (totalOperaciones === 0 || totalOperaciones > 500) {

            throw new Error(
                "La migración requiere entre 1 y 500 operaciones."
            );
        }

        const ids = [
            ...altas.map(productor => productor.id),
            ...actualizaciones.map(actualizacion => actualizacion.id)
        ];

        if (ids.some(id => !id?.trim() || id.includes("/"))) {

            throw new Error(
                "La migración contiene identificadores inválidos."
            );
        }

        // Un documento no puede participar en más de una
        // operación dentro del mismo plan de migración.
        if (new Set(ids).size !== ids.length) {

            throw new Error(
                "La migración contiene identificadores duplicados."
            );
        }

        const coleccion = this.firestore.collection(
            this.COLLECTION_NAME
        );

        const batch = this.firestore.batch();
        const fecha = Timestamp.now();

        // ========================================================
        // PREPARACIÓN DE ALTAS
        // ========================================================

        for (const productor of altas) {

            const id = productor.id;

            if (!esPASValido(productor)) {

                throw new Error(
                    `Estructura inválida para el nuevo PAS: ${id}`
                );
            }

            const {
                id: _id,
                fechaCreacion: _fechaCreacion,
                fechaActualizacion: _fechaActualizacion,
                ...datos
            } = productor;

            // create() garantiza que no se sobrescriba
            // un documento previamente existente.
            batch.create(coleccion.doc(id), {
                ...datos,
                fechaCreacion: fecha,
                fechaActualizacion: fecha
            });
        }

        // ========================================================
        // PREPARACIÓN DE ACTUALIZACIONES
        // ========================================================

        for (const actualizacion of actualizaciones) {

            const { id, cambios, versionEsperada } = actualizacion;

            const referencia = coleccion.doc(id);
            const documento = await referencia.get();

            if (!documento.exists) {

                throw new Error(
                    `El productor a actualizar no existe: ${id}`
                );
            }

            // Comprueba que el documento conserve la versión
            // utilizada durante la planificación.
            if (!documento.updateTime?.isEqual(versionEsperada)) {

                throw new Error(
                    `El productor ${id} fue modificado ` +
                    "durante la planificación de la migración."
                );
            }

            // Protege los campos administrados por el repositorio,
            // incluso ante datos recibidos fuera del contrato TypeScript.
            const {
                id: _id,
                fechaCreacion: _fechaCreacion,
                fechaActualizacion: _fechaActualizacion,
                ...campos
            } = cambios as Partial<PAS>;

            if (Object.keys(campos).length === 0) {

                throw new Error(
                    `No se informaron cambios para el productor: ${id}`
                );
            }

            // Valida el documento completo resultante,
            // no solamente los campos que serán modificados.
            const productorResultante: unknown = {
                ...documento.data(),
                ...campos,
                id
            };

            if (!esPASValido(productorResultante)) {

                throw new Error(
                    `La actualización genera un PAS inválido: ${id}`
                );
            }

            // La precondición también protege el intervalo
            // comprendido entre esta lectura y el commit.
            batch.update(
                referencia,
                {
                    ...campos,
                    fechaActualizacion: fecha
                },
                {
                    lastUpdateTime: versionEsperada
                }
            );
        }

        // ========================================================
        // CONFIRMACIÓN ATÓMICA
        // ========================================================

        // Si alguna operación falla, Firestore rechaza
        // el lote completo sin aplicar escrituras parciales.
        await batch.commit();

        return {
            incorporados: altas.length,
            actualizados: actualizaciones.length,
            totalOperaciones
        };
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
