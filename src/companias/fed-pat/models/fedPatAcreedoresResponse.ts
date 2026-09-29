import { FedPatAcreedor } from "./fedPatAcreedor";
import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";

/**
 * Representa la respuesta del endpoint de acreedores
 * de la API de Cartera de Federación Patronal.
 *
 * La colección contiene los acreedores informados para la fecha
 * consultada a nivel organizador.
 *
 * Los acreedores pueden relacionarse posteriormente con los
 * certificados mediante `codigo_acreedor`.
 */
export interface FedPatAcreedoresResponse  extends FedPatCarteraResponseBase {

    acreedores: FedPatAcreedor[];
}