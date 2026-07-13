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

    /**
     * Fin del período actual de facturación.
     */
    hasta: string;

    /**
     * Fin real de la vigencia de la póliza.
     */
    finPoliza: string;

    /**
     * Días restantes hasta la próxima refacturación.
     */
    diasParaRefacturar: number;
}