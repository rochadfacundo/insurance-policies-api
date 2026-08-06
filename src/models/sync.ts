export interface ErrorProductor {
    codigo: number;
    nombre: string;
    status?: number;
    mensaje: string;
    detalle?: unknown;
}


export interface ResumenGeneral {
    productoresTotales: number;
    productoresProcesados: number;
    productoresExitosos: number;
    productoresConError: number;

    riesgosActuales: number;
    riesgosNuevos: number;
    riesgosActualizados: number;
    riesgosEliminados: number;

    duracionTotal: string;
}


export interface ErrorNormalizado {
    mensaje: string;
    status?: number;
    detalle?: unknown;
}