/**
 * Representa un componente económico asociado a un certificado y endoso
 * obtenido desde la API de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/certificados-componentes.
 *
 * El registro se relaciona con una póliza, certificado y movimiento
 * mediante `codigo_ramo`, `numero_poliza`, `certificado` y `endoso`.
 *
 * `codigo` identifica el tipo de componente económico y `valor`
 * representa el importe correspondiente a dicho componente.
 *
 * Los valores pueden representar movimientos económicos asociados a
 * endosos y pueden ser negativos. Por este motivo, no deben interpretarse
 * directamente como importes actuales o totales de la póliza.
 */
export interface FedPatCertificadoComponente {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    endoso: number;

    codigo: number;
    valor: number;
}