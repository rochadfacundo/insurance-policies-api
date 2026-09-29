import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatCertificadoSuma } from "./fedPatCertificadoSuma";

/**
 * Representa la respuesta del endpoint de sumas de certificados
 * de la API de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora los valores económicos agregados de los certificados
 * informados para la fecha consultada.
 *
 * Cada registro puede relacionarse con un certificado mediante
 * `codigo_ramo`, `numero_poliza` y `certificado`.
 *
 * Los valores de suma asegurada, premio y prima se mantienen tal como
 * son informados por Federación Patronal. La interpretación de estos
 * importes debe realizarse posteriormente en la capa de negocio.
 */
export interface FedPatCertificadosSumasResponse  extends FedPatCarteraResponseBase {

    certificados_sumas: FedPatCertificadoSuma[];
}