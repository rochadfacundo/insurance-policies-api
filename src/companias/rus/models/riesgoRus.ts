import { TipoRiesgo } from "../../../models/TipoRiesgo";

export interface RiesgoRUS {

    codigoProductor: number;
    nombreProductor?: string;
    poliza: number;
    asegurado: string;
    patente: string | null;
    cantidadVehiculos: number;
    premio: number;
    cobertura: string;
    desde: string;
    hasta: string;
    estadoPoliza: string;
    vigenciaEstado: string;
    diasParaVencer: number;
    seccion: string;
    numeroSeccion: number;
    tipo: TipoRiesgo;
    interesAsegurable: string | null;
    
}