import productores from "./data/productoresRus.json";
import productores2 from "./data/productoresRus2.json";
import productores3 from "./data/productoresRus3.json";

export interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id: number;
}

export function obtenerProductoresRUS(): ProductorRUS[] {
    return productores.filter(p => p.estado_id === 1) as ProductorRUS[];
}


export function obtenerProductoresRUS2(): ProductorRUS[] {
    return productores2.filter(p => p.estado_id === 1) as ProductorRUS[];
}


export function obtenerProductoresRUS3(): ProductorRUS[] {
    return productores3.filter(p => p.estado_id === 1) as ProductorRUS[];
}