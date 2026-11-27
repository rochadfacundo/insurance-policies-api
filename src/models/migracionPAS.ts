import { Timestamp } from "firebase-admin/firestore";
import { PAS } from "./pas";

/**
 * Campos de un productor que pueden modificarse
 * durante una migración.
 *
 * Excluye el identificador y las fechas de auditoría,
 * cuya administración corresponde al repositorio.
 */
export type CamposActualizablesPAS = Partial<
    Omit<PAS, "id" | "fechaCreacion" | "fechaActualizacion">
>;

/**
 * Representa una actualización planificada sobre
 * un productor existente.
 */
export interface ActualizacionMigracionPAS {

    /** Identificador del productor a actualizar. */
    id: string;

    /** Campos que serán modificados. */
    cambios: CamposActualizablesPAS;

    /**
     * Versión del documento recuperada desde Firestore
     * durante la planificación de la migración.
     *
     * Permite detectar modificaciones concurrentes.
     */
    versionEsperada: Timestamp;
}

/**
 * Conjunto de operaciones que deben persistirse
 * mediante una única escritura atómica.
 */
export interface PlanMigracionPAS {

    /** Productores que serán incorporados. */
    altas: PAS[];

    /** Productores existentes que serán actualizados. */
    actualizaciones: ActualizacionMigracionPAS[];
}

/**
 * Resultado de una migración confirmada en Firestore.
 */
export interface ResultadoMigracionPAS {

    /** Cantidad de productores incorporados. */
    incorporados: number;

    /** Cantidad de productores actualizados. */
    actualizados: number;

    /** Cantidad total de operaciones confirmadas. */
    totalOperaciones: number;
}

/**
 * Representa un productor junto con la versión
 * de su documento en Firestore.
 *
 * Se utiliza para planificar actualizaciones seguras.
 */
export interface PASVersionado {

    productor: PAS;

    version: Timestamp;
}