export interface Aseguradora {
    id: string;
    nombre: string;
    activa: boolean;
  }

  export type EstadoCodigoAseguradora =
  | "PROPIO"
  | "SUBCODIGO"
  | "OTRA_ORGANIZACION"
  | "BAJA"
  | "PENDIENTE"
  | "SIN_CODIGO"
  | "REVISAR";

  export type EstadoRC =
    | "VIGENTE"
    | "NO_TIENE"
    | "EN_TRAMITE"
    | "DESCONOCIDO";

/**
 * Representa una vinculación comercial entre un productor
 * y una compañía aseguradora.
 *
 * Agrupa códigos comerciales que comparten un mismo estado.
 *
 * Un productor puede tener múltiples vinculaciones con una
 * misma aseguradora cuando sus códigos poseen estados diferentes.
 *
 * Cada código debe ser único dentro de la misma aseguradora
 * para un productor determinado.
 */
export interface CodigoAseguradora {

  /** Identificador de la compañía aseguradora. */
  aseguradoraId: string;

  /**
   * Códigos comerciales asociados a esta vinculación.
   * Todos los códigos comparten el estado definido en el registro.
   *
   * Puede estar vacío cuando no existe un código informado.
   */
  codigos: string[];

  /** Estado comercial compartido por los códigos de la vinculación. */
  estado: EstadoCodigoAseguradora;

  /** Valor original recuperado desde la fuente de importación. */
  valorOriginal?: string;

  /** Observaciones adicionales sobre la vinculación comercial. */
  observacion?: string;
}