import { TipoVigencia } from "./tipoVigencia";

export interface Vigencia {
    desde: Date;
    hasta: Date;
    
    diasParaVencer: number;

    tipo: TipoVigencia;


}