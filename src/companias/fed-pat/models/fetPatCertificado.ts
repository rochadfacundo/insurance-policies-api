/**
 * Representa un certificado obtenido desde la API de Cartera
 * de Federación Patronal.
 *
 * El modelo mantiene la estructura original de la respuesta de la API
 * para evitar transformaciones dentro de los servicios de integración.
 *
 * Un certificado pertenece a una póliza y se identifica mediante la
 * combinación de codigo_ramo, numero_poliza y certificado.
 *
 * En pólizas colectivas, el certificado 0 puede representar la cabecera
 * de la póliza, mientras que los certificados mayores a 0 pueden
 * representar bienes asegurados individuales.
 */
export interface FedPatCertificado {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;

    tipo_asegurado: string;
    codigo_asegurado: string;

    estado_certificado: number;
    fecha_estado: string;

    fecha_emision: string;
    vigencia_desde: string;
    vigencia_hasta: string;

    renovacion_aumatica: string;

    codigo_productor: number;
    codigo_acreedor: number | null;

    forma_pago: number;
    numero_tarjeta: string | null;
    codigo_tarjeta: string | null;

    tipo_poliza: string;
    moneda: string;

    renovada_por: number | null;

    agencia: number;

    renueva_a: number | null;

    tipo_facturacion: string;
    cant_facturacion: number;
}