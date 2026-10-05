/**
 * Representa una cobertura definida en el catálogo
 * de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * `/cartera/coberturas`.
 *
 * Este catálogo se utilizará para interpretar los códigos
 * informados por el feed `riesgos-cubiertos`.
 *
 * La relación exacta entre `ramo` / `codigo` y los campos
 * `codigo_ramo_cobertura` / `codigo_cobertura` se validará
 * contra datos reales antes de utilizarla como regla de negocio.
 */
export interface FedPatCobertura {

    /**
     * Código de ramo al que pertenece la cobertura.
     *
     * La API lo expone como string en este catálogo.
     */
    ramo: string;

    /**
     * Código identificador de la cobertura dentro del ramo.
     */
    codigo: string;

    /**
     * Descripción legible de la cobertura.
     */
    descripcion: string;

    /**
     * Sección informada por Federación Patronal
     * para la cobertura.
     */
    seccion: string;
}