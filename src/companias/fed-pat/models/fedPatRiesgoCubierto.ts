/**
 * Representa una cobertura asociada a un certificado y endoso obtenida
 * desde la API de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/riesgos-cubiertos.
 *
 * El registro se relaciona con una póliza, certificado y movimiento
 * mediante `codigo_ramo`, `numero_poliza`, `certificado` y `endoso`.
 *
 * `codigo_ramo_cobertura` y `codigo_cobertura` identifican la cobertura
 * aplicada al riesgo.
 *
 * Los importes de `suma_asegurada` y `prima` corresponden al registro
 * de cobertura del endoso. Pueden contener valores negativos, por lo que
 * no deben interpretarse ni acumularse directamente como valores actuales
 * de la póliza sin considerar previamente la semántica del movimiento.
 */
export interface FedPatRiesgoCubierto {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    endoso: number;

    codigo_ramo_cobertura: number;
    codigo_cobertura: number;

    suma_asegurada: number;
    prima: number;
}