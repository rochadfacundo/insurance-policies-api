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

export interface CodigoAseguradora {
  aseguradoraId: string;
  codigos: string[];
  estado: EstadoCodigoAseguradora;
  valorOriginal?: string;
  observacion?: string;
}