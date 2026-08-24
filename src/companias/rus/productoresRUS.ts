import productores from "./data/productoresRus.json";


export interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id: number;
}

export function obtenerProductoresRUS(): ProductorRUS[] {
    return productores.filter(p => p.estado_id === 1) as ProductorRUS[];
}
