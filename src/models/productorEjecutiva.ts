import { Ejecutiva } from "./ejecutiva";
import { ProductorBase } from "./productor";

export interface ProductorEjecutiva {

    // El código del productor se utiliza como ID del documento en Firestore.
    productor: ProductorBase;
    // La ejecutiva asociada al productor.
    ejecutiva: Ejecutiva;
}