import productores0 from "./data/productoresRus0.json";
import productores1 from "./data/productoresRus9.json";


export interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id: number;
}

export function obtenerProductoresRUS0(): ProductorRUS[] {
    return productores0.filter(p => p.estado_id === 1) as ProductorRUS[];
}


export function obtenerProductoresRUS1(): ProductorRUS[] {
    return productores1.filter(p => p.estado_id === 1) as ProductorRUS[];
}
