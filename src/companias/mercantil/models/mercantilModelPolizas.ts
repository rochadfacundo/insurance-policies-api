// models/mercantil-polizas.model.ts

export interface MercantilPolizasResponse {
    productor: number;
    offset: number;
    limit: number;
    total: number;
    polizas: MercantilPoliza[];
  }
  
  export interface MercantilPoliza {
    poliza: number;
    polizaAnterior: number;
    nombreAsegurado: string;
    codigoAsegurado: number;
    bienAsegurado: string;
    desde: string;      // formato YYYY-MM-DD
    hasta: string;      // formato YYYY-MM-DD
    finPoliza: string;  // formato YYYY-MM-DD
    endoso: number;
    tipoRenovacion: TipoRenovacionMercantil;
    numeroCliente: number;
    documento: number;
    seccion: number;
    productor: number;
    nombreProductor: string;
  }
  
  export type TipoRenovacionMercantil = "A" | "M" | string;