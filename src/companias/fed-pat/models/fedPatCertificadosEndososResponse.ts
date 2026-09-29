import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatCertificadoEndoso } from "./fedPatCertificadoEndoso";

/**
 * Representa la respuesta del endpoint de endosos de certificados
 * de la API de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora los movimientos de endoso informados para la
 * fecha consultada.
 *
 * Cada registro pertenece a una póliza y certificado determinados.
 * El campo `endoso` representa el número secuencial del movimiento
 * y no debe confundirse con `codigo_motivo_endoso`.
 *
 * La naturaleza del movimiento puede interpretarse posteriormente
 * mediante `tipo_endoso` y `codigo_motivo_endoso`.
 */
export interface FedPatCertificadosEndososResponse
    extends FedPatCarteraResponseBase {

    endosos: FedPatCertificadoEndoso[];
}