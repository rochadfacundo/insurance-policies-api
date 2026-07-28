import { ECompania } from "./eCompania";
import { Productor } from "./productor";


export interface ErrorSincronizacion {
    compania: ECompania;
    productor: Productor;
    poliza?: number;
    endoso?: number;
    servicio: string;
    mensaje: string;
    detalle?: unknown;
}