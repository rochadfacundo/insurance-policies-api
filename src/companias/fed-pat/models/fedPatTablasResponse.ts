import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatTabla } from "./fedPatTabla";

/**
 * Representa la respuesta del endpoint de tablas
 * de la API de Cartera de Federación Patronal.
 *
 * Las tablas permiten resolver determinados valores codificados
 * utilizados dentro de los datos específicos de los productos.
 *
 * La información corresponde a la fecha solicitada.
 */
export interface FedPatTablasResponse extends FedPatCarteraResponseBase {

    tablas: FedPatTabla[];
}