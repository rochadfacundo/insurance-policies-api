import {Firestore, Timestamp} from "firebase-admin/firestore";
import { FirebaseConfig } from "../../../config/firebaseConfig";
import { EstadoSincronizacionRus, RusSyncState } from "../models/rusSyncState";
import { ModoSincronizacionRus } from "../models/modoSincronizacionRus";


export class FirestoreRusSyncStateRepository {

    private readonly COLLECTION_NAME = "sincronizacionesRus";

    private readonly firestore: Firestore;

    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }

    async obtenerPorProductor(
        codigoProductor: number
    ): Promise<RusSyncState | null> {

        const id = this.construirId(codigoProductor);

        const documento = await this.firestore
            .collection(this.COLLECTION_NAME)
            .doc(id)
            .get();

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

    async guardar(
        estado: RusSyncState
    ): Promise<void> {

        const referencia = this.firestore
            .collection(this.COLLECTION_NAME)
            .doc(estado.id);

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

    async marcarEnProceso(
        estado: RusSyncState
    ): Promise<void> {

        await this.guardar({
            ...estado,
            estado: EstadoSincronizacionRus.EN_PROCESO,
            fechaActualizacion: new Date()
        });
    }

    async marcarCompletado(estado: RusSyncState): Promise<void> {
    
        const ahora = new Date();
    
        const {
            mensajeError,
            ...estadoSinError
        } = estado;
    
        await this.guardar({
            ...estadoSinError,
            estado: EstadoSincronizacionRus.COMPLETADO,
            bootstrapCompleto: estado.modo === ModoSincronizacionRus.BOOTSTRAP ? true : estado.bootstrapCompleto,
            ultimaFechaProcesada: estado.fechaHasta,
            fechaActualizacion: ahora,
            fechaFinalizacion: ahora
        });
    }

    async marcarError(estado: RusSyncState, mensajeError: string): Promise<void> {

        await this.guardar({
            ...estado,
            estado: EstadoSincronizacionRus.ERROR,
            mensajeError,
            fechaActualizacion: new Date()
        });
    }

    construirId(codigoProductor: number): string {

        return `RUS_${codigoProductor}`;
    }

    private convertirFecha(valor: Timestamp | Date): Date {

        if (valor instanceof Timestamp) {
            return valor.toDate();
        }

        return valor;
    }

    private eliminarUndefined<T>(valor: T): T {

        if (Array.isArray(valor)) {

            return valor
                .filter(item => item !== undefined)
                .map(item => this.eliminarUndefined(item)) as T;
        }

        if (valor !== null && typeof valor === "object" && !(valor instanceof Date) && !(valor instanceof Timestamp)) {

            return Object.fromEntries(Object.entries(valor)
                    .filter(([, contenido]) =>
                        contenido !== undefined
                    )
                    .map(([clave, contenido]) => [
                        clave,
                        this.eliminarUndefined(contenido)
            ])) as T;
        }

        return valor;
    }
}