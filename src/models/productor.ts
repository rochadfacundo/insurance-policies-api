export interface ProductorBase {
    codigo: number;
    nombre: string;
    estado_id?: number;
}

export interface Productor extends ProductorBase {
    matricula: number | null;
    grupoCartera?: string;
}