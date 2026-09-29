/**
 * Representa un dato específico del producto o bien asegurado obtenido
 * desde la API de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/productos-datos.
 *
 * El registro se relaciona con una póliza, certificado y endoso mediante
 * `codigo_ramo`, `numero_poliza`, `certificado` y `endoso`.
 *
 * `codigo_dato` identifica el tipo de información almacenada y puede
 * relacionarse con el catálogo de datos de Federación Patronal.
 *
 * `valor_dato` contiene el valor asociado al dato. Dependiendo del código,
 * puede representar un valor directo (por ejemplo, patente o chasis) o
 * un código que posteriormente debe resolverse mediante el catálogo
 * de tablas.
 */
export interface FedPatProductoDato {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    endoso: number;

    codigo_dato: string;
    valor_dato: string;
}