import { ECompania } from "./eCompania";
import { Productor, ProductorBase } from "./productor";
import { TipoRiesgo } from "./TipoRiesgo";

export interface PolizaEliminada {
    id: string;
  
    compania: ECompania;
  
    productor: ProductorBase;
  
    numeroPoliza: number;
    endoso?: number;
  
    asegurado?: string;
  
    riesgosAnteriores: TipoRiesgo[];
  
    motivo: MotivoEliminacionPoliza;
  
    fechaEliminacion: Date;
  
    polizaRenovada?: number;
  }

  export enum MotivoEliminacionPoliza {
    DEJO_DE_SER_RIESGO = "DEJO_DE_SER_RIESGO",
    YA_NO_ESTA_VIGENTE = "YA_NO_ESTA_VIGENTE",
    RENOVADA = "RENOVADA"
  }