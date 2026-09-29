import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatCertificado } from "./fetPatCertificado";


/**
 * Representa la respuesta del endpoint de certificados de la API
 * de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora los certificados informados para la fecha consultada.
 *
 * Cada certificado mantiene como clave natural la combinación de
 * `codigo_ramo`, `numero_poliza` y `certificado`.
 */
export interface FedPatCertificadosResponse
    extends FedPatCarteraResponseBase {

    certificados: FedPatCertificado[];
}