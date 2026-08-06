import { Firestore, Timestamp, WriteBatch } from "firebase-admin/firestore";

import { FirebaseConfig } from "../config/firebaseConfig";
import { Poliza } from "../models/poliza";
import { MotivoEliminacionPoliza, PolizaEliminada } from "../models/polizaEliminada";

export class FirestorePolizaEliminadaRepository {

    /**
     * Atributos privados de la clase FirestorePolizaEliminadaRepository.
     * Colección de Firestore donde se almacenan las pólizas eliminadas y la instancia de Firestore.
     * COLLECTION_NAME: Nombre de la colección de Firestore donde se almacenan las pólizas eliminadas.
     * firestore: Instancia de Firestore utilizada para interactuar con la base de datos. 
     */
    private readonly COLLECTION_NAME = "polizasEliminadas";
    private readonly firestore: Firestore;

    /**
     * Crea una instancia de FirestorePolizaEliminadaRepository y establece la conexión con Firestore.
     */
    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }

    /**
     * Guarda una póliza eliminada en Firestore a partir de un objeto Poliza y un motivo de eliminación.
     * Si la póliza tiene un endoso, se agrega al objeto PolizaEliminada.
     * Si la póliza tiene un nombre de cliente, se agrega al objeto PolizaEliminada. 
     * Si la póliza no tiene endoso o nombre de cliente, se omiten esos campos en el objeto PolizaEliminada.
     * Si la póliza ya existe en Firestore, se actualiza con los nuevos datos.
     * @param poliza póliza que se desea guardar como eliminada. 
     * @param motivo motivo de eliminación de la póliza. 
     * @returns una promesa que se resuelve cuando la póliza eliminada ha sido guardada en Firestore.
     * @see PolizaEliminada para la estructura de la póliza eliminada.
     * @see MotivoEliminacionPoliza para la estructura del motivo de eliminación de la póliza.
     * @see Poliza para la estructura de la póliza.
     */
    async guardarDesdePoliza(poliza: Poliza, motivo: MotivoEliminacionPoliza): Promise<void> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(poliza.id);

        const datos: PolizaEliminada = {
            id: poliza.id,
            compania: poliza.compania,
            productor: poliza.productor,
            numeroPoliza: poliza.detallePoliza.numeroPoliza,
            riesgosAnteriores: poliza.riesgos,
            motivo,
            fechaEliminacion: new Date(),
        };

        if (poliza.detallePoliza.endoso !== undefined) {
            datos.endoso = poliza.detallePoliza.endoso;
        }

        if (poliza.cliente.nombre !== undefined) {
            datos.asegurado = poliza.cliente.nombre;
        }

        await referencia.set(this.prepararDocumento(datos),{ merge: true});
    }

    /**
     * Guarda una póliza eliminada en Firestore a partir de un objeto PolizaEliminada.
     * Si la póliza eliminada ya existe en Firestore, se actualiza con los nuevos datos.  
     * @param polizaEliminada póliza eliminada que se desea guardar.
     * @returns una promesa que se resuelve cuando la póliza eliminada ha sido guardada en Firestore. 
     * @see PolizaEliminada para la estructura de la póliza eliminada.
     */
    async guardar(polizaEliminada: PolizaEliminada): Promise<void> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(polizaEliminada.id);

        await referencia.set(this.prepararDocumento(polizaEliminada),{  merge: true });
    }

    /**
     * Elimina una póliza eliminada de Firestore a partir de su identificador. 
     * @param id identificador de la póliza eliminada que se desea eliminar.
     * @returns una promesa que se resuelve cuando la póliza eliminada ha sido eliminada de Firestore. 
     */
    async eliminar(id: string): Promise<void> {
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
    }


    /**
     * Obtiene una póliza eliminada de Firestore a partir de su identificador. 
     * @param id identificador de la póliza eliminada que se desea obtener. 
     * @returns una promesa que se resuelve con un objeto PolizaEliminada si se encuentra la póliza eliminada, o null si no se encuentra. 
     */
    async obtenerPorId(id: string): Promise<PolizaEliminada | null> {

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
            fechaEliminacion: this.convertirFecha(datos["fechaEliminacion"])
        } as PolizaEliminada;
    }

    /**
     * Prepara un objeto PolizaEliminada para ser guardado en Firestore, 
     * eliminando los campos undefined y convirtiendo la fecha de eliminación a Timestamp. 
     * @param polizaEliminada póliza eliminada que se desea preparar para ser guardada en Firestore. 
     * @returns un objeto con los datos de la póliza eliminada listos para ser guardados en Firestore. 
     */
    private prepararDocumento(polizaEliminada: PolizaEliminada): Record<string, unknown> {
    
      return this.eliminarUndefined({...polizaEliminada,fechaEliminacion: Timestamp.fromDate(polizaEliminada.fechaEliminacion)});
    }

    /**
     * Convierte un valor de tipo Timestamp o Date a Date, o devuelve undefined si el valor es undefined. 
     * @param valor valor de tipo Timestamp, Date o undefined que se desea convertir a Date. 
     * @returns un objeto Date si el valor es de tipo Timestamp o Date, o undefined si el valor es undefined. 
     */
    private convertirFecha(valor: Timestamp | Date | undefined): Date | undefined {

        if (valor instanceof Timestamp) {
            return valor.toDate();
        }

        return valor;
    }

    /**
     * Elimina los campos undefined de un objeto o array de manera recursiva. 
     * @param valor valor de tipo T que se desea limpiar de campos undefined. 
     * @returns un objeto o array de tipo T sin campos undefined. 
     */
    private eliminarUndefined<T>(valor: T): T {

        if (Array.isArray(valor)) {

            return valor.filter(item => item !== undefined).map(item => this.eliminarUndefined(item)) as T;
        }

        if (valor !== null && typeof valor === "object" && !(valor instanceof Date) && !(valor instanceof Timestamp)) {

            return Object.fromEntries(Object.entries(valor).filter(([, contenido]) => contenido !== undefined)
                    .map(([clave, contenido]) => [ clave, this.eliminarUndefined(contenido)])) as T;
        }

        return valor;
    }

    /**
     * Agrega la eliminación de un registro al batch. 
     * @param batch objeto WriteBatch al cual se desea agregar la eliminación del registro.      
     * @param id identificador del registro que se desea eliminar. 
     */
    agregarEliminacionAlBatch(batch: WriteBatch,id: string): void {
    
        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(id);
    
        batch.delete(referencia);
    }

    /**
     * Agrega la creación o actualización de un registro al batch. 
     * @param batch objeto WriteBatch al cual se desea agregar la creación o actualización del registro. 
     * @param poliza objeto Poliza que se desea guardar como registro eliminado. 
     * @param motivo motivo de eliminación de la póliza.
     * @see Poliza
     * @see MotivoEliminacionPoliza 
     */
    agregarGuardadoDesdePolizaAlBatch(batch: WriteBatch, poliza: Poliza, motivo: MotivoEliminacionPoliza): void {
    
        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(poliza.id);
    
        const datos: PolizaEliminada = {
            id: poliza.id,
            compania: poliza.compania,
            productor: poliza.productor,
            numeroPoliza: poliza.detallePoliza.numeroPoliza,
            riesgosAnteriores: poliza.riesgos,
            motivo,
            fechaEliminacion: new Date()
        };
    
        if (poliza.detallePoliza.endoso !== undefined) {
            datos.endoso = poliza.detallePoliza.endoso;
        }
    
        if (poliza.cliente.nombre !== undefined) {
            datos.asegurado = poliza.cliente.nombre;
        }
    
        batch.set(referencia,this.prepararDocumento(datos),
            {
                merge: true
            });
    }
}