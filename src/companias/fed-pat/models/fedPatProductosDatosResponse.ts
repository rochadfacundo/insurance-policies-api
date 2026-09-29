import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatProductoDato } from "./fedPatProductoDato";

/**
 * Representa la respuesta del endpoint de datos de productos
 * de la API de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora los datos específicos de los bienes asegurados
 * informados para la fecha consultada.
 *
 * Cada registro puede asociarse a una póliza, certificado y endoso
 * mediante `codigo_ramo`, `numero_poliza`, `certificado` y `endoso`.
 *
 * Los valores contenidos en `productos_datos` pueden representar
 * información directa, como patente o chasis, o valores codificados
 * que posteriormente deben resolverse utilizando los catálogos
 * correspondientes.
 */
export interface FedPatProductosDatosResponse   extends FedPatCarteraResponseBase {

    producto_datos: FedPatProductoDato[];
}