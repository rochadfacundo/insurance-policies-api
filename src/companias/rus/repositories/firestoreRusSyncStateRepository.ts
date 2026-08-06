import {Firestore, Timestamp} from "firebase-admin/firestore";
import { FirebaseConfig } from "../../../config/firebaseConfig";
import { EstadoSincronizacionRus, RusSyncState } from "../models/rusSyncState";
import { ModoSincronizacionRus } from "../models/modoSincronizacionRus";


export class FirestoreRusSyncStateRepository {

    /**
     * Atributos privados de la clase FirestoreRusSyncStateRepository.
     * Colección de Firestore donde se almacenan los estados de sincronización de RUS y la instancia de Firestore.
     * Nombre de la colección de Firestore donde se almacenan los estados de sincronización de RUS. 
     */
    private readonly COLLECTION_NAME = "sincronizacionesRus";
    private readonly firestore: Firestore;

    /**
     * Crea una instancia de FirestoreRusSyncStateRepository y establece la conexión con Firestore. 
     */
    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }


    /**
     * Obtiene el estado de sincronización de RUS para un productor específico.
     * @param codigoProductor código del productor para el cual se desea obtener el estado de sincronización.
     * @returns retorna un objeto RusSyncState con el estado de sincronización del productor,
     *  o null si no se encuentra ningún registro para el productor.
     */
    async obtenerPorProductor(codigoProductor: number): Promise<RusSyncState | null> {

        const id = this.construirId(codigoProductor);

        const documento = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!documento.exists) {
            return null;
        }

        const datos = documento.data();

        if (!datos) {
            return null;
        }

        return {
            ...datos,
            id: documento.id,
            fechaInicio: this.convertirFecha(datos["fechaInicio"]),
            fechaActualizacion: this.convertirFecha(
                datos["fechaActualizacion"]
            ),
            fechaFinalizacion: datos["fechaFinalizacion"]
                ? this.convertirFecha(datos["fechaFinalizacion"])
                : undefined
        } as RusSyncState;
    }

    /**
     * Guarda el estado de sincronización de RUS para un productor específico en Firestore.
     * @param estado estado de sincronización a guardar.
     * @returns una promesa que se resuelve cuando el estado se ha guardado correctamente.
     */
    async guardar(estado: RusSyncState): Promise<void> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(estado.id);

        const datos = this.eliminarUndefined({
            ...estado,
            fechaInicio: Timestamp.fromDate(estado.fechaInicio),
            fechaActualizacion: Timestamp.fromDate(
                estado.fechaActualizacion
            ),
            fechaFinalizacion: estado.fechaFinalizacion
                ? Timestamp.fromDate(estado.fechaFinalizacion)
                : undefined
        });

        await referencia.set(datos);
    }

    /**
     * función que marca el estado de sincronización de RUS como "EN_PROCESO" para un productor específico.
     * @param estado estado de sincronización a actualizar.
     * @returns una promesa que se resuelve cuando el estado se ha actualizado correctamente. 
     */
    async marcarEnProceso(estado: RusSyncState): Promise<void> {
        await this.guardar({...estado,estado: EstadoSincronizacionRus.EN_PROCESO,fechaActualizacion: new Date()});
    }

    /**
     * función que marca el estado de sincronización de RUS como "COMPLETADO" para un productor específico. 
     * @param estado estado de sincronización a actualizar.
     * @returns una promesa que se resuelve cuando el estado se ha actualizado correctamente. 
     */
    async marcarCompletado(estado: RusSyncState): Promise<void> {
    
        const ahora = new Date();
    
        const {mensajeError, ...estadoSinError } = estado;
    
        await this.guardar({
            ...estadoSinError,
            estado: EstadoSincronizacionRus.COMPLETADO,
            bootstrapCompleto: estado.modo === ModoSincronizacionRus.BOOTSTRAP ? true : estado.bootstrapCompleto,
            ultimaFechaProcesada: estado.fechaHasta,
            fechaActualizacion: ahora,
            fechaFinalizacion: ahora
        });
    }

    /**
     * función que marca el estado de sincronización de RUS como "ERROR" para un productor específico, y guarda un mensaje de error. 
     * @param estado estado de sincronización a actualizar. 
     * @param mensajeError mensaje de error a guardar.
     * @returns una promesa que se resuelve cuando el estado se ha actualizado correctamente. 
     */
    async marcarError(estado: RusSyncState, mensajeError: string): Promise<void> {

        await this.guardar({
            ...estado,
            estado: EstadoSincronizacionRus.ERROR,
            mensajeError,
            fechaActualizacion: new Date()
        });
    }

    /**
     * Construye un ID único para un productor específico, utilizando el prefijo "RUS_" seguido del código del productor. 
     * @param codigoProductor código del productor para el cual se desea construir el ID. 
     * @returns un string que representa el ID único del productor en la colección de sincronizaciones de RUS. 
     */
    construirId(codigoProductor: number): string {

        return `RUS_${codigoProductor}`;
    }

    /**
     * Convierte un valor de tipo Timestamp o Date a un objeto Date. 
     * @param valor valor de tipo Timestamp o Date a convertir. 
     * @returns un objeto Date correspondiente al valor proporcionado. 
     */
    private convertirFecha(valor: Timestamp | Date): Date {

        if (valor instanceof Timestamp) {
            return valor.toDate();
        }

        return valor;
    }

    /**
     * Elimina recursivamente todas las propiedades con valor undefined de un objeto o array. 
     * @param valor objeto o array del cual se desea eliminar las propiedades con valor undefined.      
     * @returns un nuevo objeto o array sin las propiedades con valor undefined. 
     */
    private eliminarUndefined<T>(valor: T): T {

        if (Array.isArray(valor)) {

            return valor.filter(item => item !== undefined).map(item => this.eliminarUndefined(item)) as T;
        }

        if (valor !== null && typeof valor === "object" && !(valor instanceof Date) && !(valor instanceof Timestamp)) {

            return Object.fromEntries(Object.entries(valor).filter(([, contenido]) => contenido !== undefined)
                    .map(([clave, contenido]) => [ clave,  this.eliminarUndefined(contenido) ])) as T;
        }

        return valor;
    }
}