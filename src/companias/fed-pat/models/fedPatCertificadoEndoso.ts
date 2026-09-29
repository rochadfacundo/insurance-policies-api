/**
 * Representa un endoso asociado a un certificado obtenido desde la API
 * de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/certificados-endosos.
 *
 * El campo `endoso` identifica el número secuencial del movimiento dentro
 * de la póliza. No debe confundirse con `codigo_motivo_endoso`.
 *
 * La naturaleza del movimiento se determina mediante la combinación
 * de `tipo_endoso` y `codigo_motivo_endoso`, que puede relacionarse
 * posteriormente con el catálogo de motivos de endoso.
 *
 * Las fechas de vigencia corresponden al movimiento/endoso y no deben
 * asumirse como la vigencia general del certificado.
 */
export interface FedPatCertificadoEndoso {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    endoso: number;

    fecha_emision: string;
    vigencia_desde: string;
    vigencia_hasta: string;

    tipo_endoso: string;
    codigo_motivo_endoso: number;

    numero_cotizacion: number | null;
    consecutivo: number;

    codigo_plan: string | null;

    tipo_contratante: string;
    codigo_contratante: string;

    tipo_asegurado: string;
    codigo_asegurado: string;

    moneda: string;

    anexos: string | null;
    ubicacion: string | null;

    codigo_localidad: number | null;
    codigo_postal: string | null;

    suma_asegurada: number;
    prima: number;

    codigo_producto: string;
    numero_solicitud: number | null;
}