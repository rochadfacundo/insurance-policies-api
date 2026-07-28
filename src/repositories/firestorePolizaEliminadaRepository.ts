import { Firestore, Timestamp, WriteBatch } from "firebase-admin/firestore";

import { FirebaseConfig } from "../config/firebaseConfig";
import { Poliza } from "../models/poliza";
import { MotivoEliminacionPoliza, PolizaEliminada } from "../models/polizaEliminada";

export class FirestorePolizaEliminadaRepository {

    private readonly COLLECTION_NAME = "polizasEliminadas";

    private readonly firestore: Firestore;

    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }

    /**
     * Guarda un registro reducido de una póliza
     * que dejó de formar parte de los riesgos activos.
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
     * Guarda directamente un objeto PolizaEliminada.
     */
    async guardar(polizaEliminada: PolizaEliminada): Promise<void> {

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(polizaEliminada.id);

        await referencia.set(this.prepararDocumento(polizaEliminada),{  merge: true });
    }

    /*
        * Elimina un registro de póliza eliminada.
    */
    async eliminar(id: string): Promise<void> {
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
    }


    /**
     * Obtiene una póliza eliminada por su identificador.
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
     * Prepara el documento para Firestore.
     */
    private prepararDocumento(polizaEliminada: PolizaEliminada): Record<string, unknown> {
    
      return this.eliminarUndefined({...polizaEliminada,fechaEliminacion: Timestamp.fromDate(polizaEliminada.fechaEliminacion)});
    }

    private convertirFecha(valor: Timestamp | Date | undefined): Date | undefined {

        if (valor instanceof Timestamp) {
            return valor.toDate();
        }

        return valor;
    }

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

    /*
        * Agrega la eliminación de un registro al batch.
    */
    agregarEliminacionAlBatch(batch: WriteBatch,id: string): void {
    
        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(id);
    
        batch.delete(referencia);
    }

    /*
        * Agrega la creación de un registro al batch.
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