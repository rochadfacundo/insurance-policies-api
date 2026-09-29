/**
 * Representa la respuesta del servidor OAuth de Federación Patronal
 * al solicitar un token de acceso.
 *
 * El token obtenido se utiliza posteriormente como Bearer Token
 * para realizar las consultas a la API de Cartera.
 *
 * `expires_in` indica la duración del token en segundos.
 *
 * Este modelo contiene exclusivamente la respuesta de autenticación.
 * Las credenciales utilizadas para obtener el token nunca deben
 * almacenarse dentro de este objeto.
 */
export interface FedPatAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    jti: string;
}