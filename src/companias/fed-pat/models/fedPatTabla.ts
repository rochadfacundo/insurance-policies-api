/**
 * Representa un valor perteneciente a las tablas de codificación
 * utilizadas por Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/tablas.
 *
 * `codigo` identifica el tipo de dato al que pertenece el valor y puede
 * relacionarse con el catálogo de datos de Federación Patronal.
 *
 * `indice` representa el valor codificado utilizado en productos-datos,
 * mientras que `descripcion` contiene su representación legible.
 *
 * No todos los valores de productos-datos requieren una traducción mediante
 * este catálogo, ya que algunos contienen información directa como patente
 * o número de chasis.
 */
export interface FedPatTabla {
    codigo: number;
    indice: string;
    descripcion: string;
}