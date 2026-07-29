import { ModoSincronizacionRus } from "./modoSincronizacionRus";

export enum EstadoSincronizacionRus {
    PENDIENTE = "PENDIENTE",
    EN_PROCESO = "EN_PROCESO",
    COMPLETADO = "COMPLETADO",
    ERROR = "ERROR"
}

export interface RusSyncState {

    id: string;

    productor: {
        codigo: number;
        nombre: string;
    };

    modo: ModoSincronizacionRus;

    estado: EstadoSincronizacionRus;

    bootstrapCompleto: boolean;

    fechaDesde: string;
    fechaHasta: string;

    ultimaFechaProcesada: string | null;

    mensajeError?: string;

    fechaInicio: Date;
    fechaActualizacion: Date;
    fechaFinalizacion?: Date;
}