import { FedPatCarteraResponseBase }
    from "./fedPatCarteraResponseBase";
import { FedPatCertificadoComponente }
    from "./fedPatCertificadoComponente";

/**
 * Representa la respuesta del endpoint de componentes económicos
 * de certificados de la API de Cartera de Federación Patronal.
 *
 * La colección contiene los componentes asociados a los distintos
 * certificados y endosos informados para la fecha consultada.
 */
export interface FedPatCertificadosComponentesResponse
    extends FedPatCarteraResponseBase {

    componentes: FedPatCertificadoComponente[];
}