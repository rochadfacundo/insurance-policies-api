/**
 * Representa un acreedor asociado a una póliza obtenido desde la API
 * de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/acreedores.
 *
 * `codigo` identifica al acreedor dentro de Federación Patronal y puede
 * relacionarse con `codigo_acreedor` presente en los certificados.
 *
 * Los campos terminados en `_p` corresponden al domicilio principal,
 * mientras que los terminados en `_s` corresponden al domicilio
 * secundario informado por Federación Patronal.
 *
 * Los datos de domicilio, contacto y cargo pueden ser nulos cuando
 * dicha información no se encuentra informada por la compañía.
 */
export interface FedPatAcreedor {
    codigo: number;
    tipo: string;
    descripcion: string;
    tipo_asegurado: string;

    calle_p: string | null;
    numero_p: string | null;
    piso_p: string | null;
    depto_p: string | null;
    codigo_postal_p: number | null;
    codigo_localidad_p: number | null;
    telefono_p: string | null;
    fax_p: string | null;

    calle_s: string | null;
    numero_s: string | null;
    piso_s: string | null;
    depto_s: string | null;
    codigo_postal_s: number | null;
    codigo_localidad_s: number | null;
    telefono_s: string | null;
    fax_s: string | null;

    contacto: string | null;
    cargo: string | null;
}