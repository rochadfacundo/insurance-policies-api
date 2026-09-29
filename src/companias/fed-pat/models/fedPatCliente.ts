/**
 * Representa un cliente o asegurado obtenido desde la API
 * de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/clientes.
 *
 * `codigo` identifica al cliente dentro de Federación Patronal y puede
 * relacionarse con `codigo_asegurado` presente en los certificados.
 *
 * Los campos terminados en `_p` corresponden al domicilio principal,
 * mientras que los terminados en `_s` corresponden al domicilio
 * secundario informado por Federación Patronal.
 *
 * Algunos datos personales y de contacto pueden ser nulos, especialmente
 * cuando el cliente corresponde a una persona jurídica o cuando la
 * información no se encuentra informada.
 */
export interface FedPatCliente {
    codigo: string;
    nombre: string;

    tipo_documento: string | null;
    numero_documento: number | null;

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

    cuit: string | null;
    tipo_sociedad: number | null;
    iva: string | null;
    sexo: string | null;

    fecha_alta: string;
    fecha_baja: string | null;

    email: string | null;
    tipo_asegurado: string;

    cobrador: number | null;

    fecha_nacimiento: string | null;
}