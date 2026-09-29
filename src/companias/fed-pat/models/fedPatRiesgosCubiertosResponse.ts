import { FedPatCarteraResponseBase } from "./fedPatCarteraResponseBase";
import { FedPatRiesgoCubierto } from "./fedPatRiesgoCubierto";

/**
 * Representa la respuesta del endpoint de riesgos cubiertos
 * de la API de Cartera de Federación Patronal.
 *
 * Extiende la estructura común de las respuestas de Cartera
 * e incorpora las coberturas informadas para los certificados
 * y endosos correspondientes a la fecha consultada.
 *
 * Cada registro representa una cobertura asociada a un certificado
 * y movimiento determinado. No debe interpretarse como un bien
 * asegurado independiente.
 *
 * Los importes pueden corresponder a movimientos económicos y contener
 * valores negativos, por lo que su interpretación debe realizarse
 * posteriormente en la capa de negocio.
 */
export interface FedPatRiesgosCubiertosResponse
    extends FedPatCarteraResponseBase {

    riesgos_cubiertos: FedPatRiesgoCubierto[];
}