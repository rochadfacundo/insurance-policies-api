import productores from "./models/data/productoresRus.json";

export interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id: number;
}

export function obtenerProductoresRUS(): ProductorRUS[] {
    return productores as ProductorRUS[];
}