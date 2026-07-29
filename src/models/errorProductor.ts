export interface ErrorProductor {
    codigo: number;
    nombre: string;
    mensaje: string;
    status?: number;
    detalle?: unknown;
}
