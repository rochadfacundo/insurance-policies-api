/**
 * Representa un tipo de dato definido en el catálogo de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/datos.
 *
 * El `codigo` identifica el tipo de información utilizada posteriormente
 * en los registros de productos-datos.
 *
 * Por ejemplo, el catálogo permite identificar códigos correspondientes
 * a patente, número de chasis, marca, modelo u otras características
 * específicas del bien asegurado.
 */
export interface FedPatDato {
    codigo: number;
    descripcion: string;
}