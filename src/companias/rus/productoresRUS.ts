import productores from "./data/productoresRus.json";
import productoresConMatricula from "./data/productoresRus-matricula.json";
import { ProductorBase } from "../../models/productor";


export interface ProductorRUS extends ProductorBase {
    estado_id: number;
}


export interface ProductorRUSConMatricula extends ProductorRUS {
    matricula: number | null;
    grupoCartera?: string;
}

export function obtenerProductoresRUS(): ProductorRUS[] {
    return productores.filter(p => p.estado_id === 1) as ProductorRUS[];
}


export function obtenerProductoresRUSConMatricula(): ProductorRUSConMatricula[] {
    return productoresConMatricula.filter(p => p.estado_id === 1) as ProductorRUSConMatricula[];
}
