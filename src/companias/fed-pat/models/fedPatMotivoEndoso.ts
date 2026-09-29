/**
 * Representa un motivo de endoso definido en el catálogo
 * de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/motivos-endoso.
 *
 * La combinación de `tpMotivos` y `codigo` identifica el motivo
 * correspondiente a un movimiento de endoso.
 *
 * Esta información permite interpretar los campos `tipo_endoso`
 * y `codigo_motivo_endoso` recibidos en certificados-endosos.
 *
 * El número de `endoso` de un certificado no debe confundirse con
 * el código del motivo de endoso.
 */
export interface FedPatMotivoEndoso {
    tpMotivos: string;
    codigo: number;
    descripcion: string;
}