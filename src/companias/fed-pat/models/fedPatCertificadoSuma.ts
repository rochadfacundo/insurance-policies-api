/**
 * Representa los importes agregados asociados a un certificado obtenidos
 * desde la API de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/certificados-sumas.
 *
 * El registro se relaciona con un certificado mediante la combinación
 * de `codigo_ramo`, `numero_poliza` y `certificado`.
 *
 * Contiene valores económicos consolidados como suma asegurada, premio
 * y prima. Estos valores deben tratarse independientemente de los importes
 * asociados a movimientos o endosos individuales.
 *
 * `premio` y `prima` pueden ser nulos según la información disponible
 * para el certificado.
 */
export interface FedPatCertificadoSuma {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;

    suma_asegurada: number;
    premio: number | null;
    prima: number | null;
}