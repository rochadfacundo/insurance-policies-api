import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatProductor } from "./fedPatProductor";

/**
 * Representa la respuesta del endpoint de productores de la API
 * de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora los productores asociados al organizador consultado.
 *
 * A diferencia de los endpoints basados en movimientos diarios,
 * la consulta de productores no requiere una fecha específica,
 * por lo que `fecha_solicitada` puede recibirse como null.
 *
 * El `codigo` de cada productor es el identificador utilizado
 * posteriormente por los certificados mediante `codigo_productor`.
 */
export interface FedPatProductoresResponse
    extends FedPatCarteraResponseBase {

    productores: FedPatProductor[];
}