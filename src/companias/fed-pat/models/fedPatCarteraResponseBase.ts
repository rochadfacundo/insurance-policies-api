/**
 * Representa los campos comunes presentes en las respuestas
 * de la API de Cartera de Federación Patronal.
 *
 * Los modelos específicos de cada endpoint pueden extender esta
 * interfaz agregando la colección correspondiente.
 *
 * `fecha_solicitada` puede ser nula en endpoints cuya consulta
 * no se encuentra asociada a una fecha específica.
 */
export interface FedPatCarteraResponseBase {
    fecha_solicitada: string | null;
    fecha_solicitud: string;
}