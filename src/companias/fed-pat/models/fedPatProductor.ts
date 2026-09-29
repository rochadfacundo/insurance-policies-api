/**
 * Representa un productor asociado al organizador obtenido desde la API
 * de Cartera de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * /cartera/productores.
 *
 * `codigo` identifica al productor dentro de Federación Patronal y se
 * relaciona con el campo `codigo_productor` de los certificados.
 *
 * `matricula` corresponde a la matrícula del Productor Asesor de Seguros
 * y puede utilizarse posteriormente para relacionar al productor de
 * Federación Patronal con los productores manejados por nuestra aplicación.
 *
 * `organizador` identifica al organizador al que pertenece el productor.
 */
export interface FedPatProductor {
    codigo: number;
    nombre: string;
    codigo_localidad: number;
    direccion: string;
    matricula: number;
    organizador: number;
    agencia: number;
}