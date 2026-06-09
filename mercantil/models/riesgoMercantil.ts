export interface RiesgoMercantil {

    codigoProductor: number;
    nombreProductor: string;

    tipo: "FLOTA" | "PRIMA_ALTA";

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