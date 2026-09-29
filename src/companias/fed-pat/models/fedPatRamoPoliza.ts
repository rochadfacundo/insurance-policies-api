/**
 * Representa un ramo de póliza definido en el catálogo
 * de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/ramos-polizas.
 *
 * `codigo` identifica el ramo y se relaciona con `codigo_ramo`
 * presente en certificados, endosos y demás registros de cartera.
 *
 * La descripción permite interpretar el ramo al que pertenece
 * una póliza sin incorporar esa información directamente en los
 * modelos operacionales.
 */
export interface FedPatRamoPoliza {
    codigo: number;
    descripcion: string;
}