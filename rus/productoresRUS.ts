import productores from "./models/data/productoresRus.json";
import productores2 from "./models/data/productoresRus2.json";
import productores3 from "./models/data/productoresRus3.json";

export interface ProductorRUS {
    codigo: number;
    nombre: string;
    estado_id: number;
}

export function obtenerProductoresRUS(): ProductorRUS[] {
    return productores.filter(p => p.estado_id === 1) as ProductorRUS[];
}