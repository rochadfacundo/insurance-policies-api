import { TipoRiesgo } from "../../../models/TipoRiesgo";

export interface RiesgoMercantil {

    codigoProductor: number;
    nombreProductor: string;

    tipo: TipoRiesgo;

    poliza: number;

    asegurado: string;

    bien: string;

    cantidadBienes: number;

    prima: number;

    cobertura: string;

    desde: string;
    hasta: string;

    diasParaVencer: number;
}