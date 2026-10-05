/**
 * Representa un plan definido en el catálogo de productos
 * de Federación Patronal.
 *
 * Mantiene la estructura original devuelta por el endpoint
 * `/cartera/prodplanes`.
 *
 * Este catálogo será utilizado para investigar la relación
 * entre el `codigo_plan` informado en los endosos y la
 * descripción comercial correspondiente.
 *
 * La relación exacta todavía no se considera una regla de negocio:
 * primero debe validarse contra datos reales de las pólizas.
 */
export interface FedPatPlan {

    /**
     * Sección a la que pertenece el plan.
     */
    seccion: string;

    /**
     * Código de productor asociado al plan.
     *
     * Se conserva como string porque así lo define
     * el contrato del endpoint.
     */
    codProductor: string;

    /**
     * Código identificador del plan.
     */
    plan: string;

    /**
     * Descripción legible del plan.
     */
    descripcion: string;
}