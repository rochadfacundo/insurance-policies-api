import { Productor } from "./productor";
import { ECompania } from "./eCompania";

export interface StatsCartera {

    matricula: number | null;

    nombreProductor: string;

    codigosProductor: number[];

    compania: ECompania;

    cantidadPolizas: number;
}