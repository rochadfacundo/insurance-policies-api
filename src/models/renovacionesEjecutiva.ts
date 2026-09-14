// src/models/renovacionesEjecutiva.ts

import { Ejecutiva } from "./ejecutiva";
import { Poliza } from "./poliza";

export interface RenovacionesEjecutiva {

    // El código de la ejecutiva se utiliza como ID del documento en Firestore.
    ejecutiva: Ejecutiva;

    // Las pólizas que están próximas a vencer en el mes siguiente a la fecha de referencia.
    polizas: Poliza[];
}