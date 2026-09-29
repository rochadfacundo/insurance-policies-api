import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatCliente } from "./fedPatCliente";

/**
 * Representa la respuesta del endpoint de clientes de la API
 * de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora la colección de clientes informados para la
 * fecha consultada.
 */
export interface FedPatClientesResponse extends FedPatCarteraResponseBase {
    clientes: FedPatCliente[];
}