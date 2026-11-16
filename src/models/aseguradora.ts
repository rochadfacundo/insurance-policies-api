export interface Aseguradora {
    id: string;
    nombre: string;
    activa: boolean;
  }

  export interface CodigoAseguradora {
    aseguradoraId: string;
    codigos: string[];
    observacion?: string;
  }