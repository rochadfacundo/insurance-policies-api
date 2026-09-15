import { Timestamp } from "firebase-admin/firestore";

import { ECompania } from "./eCompania";
import { ProductorBase } from "./productor";

export interface ProductorEjecutiva {

    /**
     * Productor asociado a la relación.
     */
    productor: ProductorBase;

    /**
     * Compañía a la que pertenece el código del productor.
     */
    compania: ECompania;

    /**
     * Identificador de la ejecutiva responsable.
     * Corresponde al ID del documento almacenado
     * en la colección "ejecutivas".
     */
    ejecutivaId: string;

    /**
     * Fecha en la que se creó originalmente
     * la relación productor-ejecutiva.
     */
    fechaCreacion?: Timestamp;

    /**
     * Fecha de la última modificación
     * realizada sobre la relación.
     */
    fechaActualizacion?: Timestamp;
}