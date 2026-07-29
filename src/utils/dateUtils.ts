import { TipoVigencia } from "../models/tipoVigencia";

export class DateUtils {

    /**
     * Convierte un string YYYY-MM-DD a Date.
     */
    static parse(fecha: string): Date {

        return new Date(`${fecha}T00:00:00`);
    }

    /**
     * Devuelve la cantidad de días entre dos fechas.
     */
    static diasEntre(desde: Date, hasta: Date): number {

        const MS_POR_DIA = 1000 * 60 * 60 * 24;

        return Math.round(
            (hasta.getTime() - desde.getTime()) / MS_POR_DIA
        );
    }

    /**
     * Devuelve los días que faltan desde hoy.
     */
    static diasHasta(fecha: Date): number {

        return this.diasEntre(new Date(), fecha);
    }

    /**
     * Determina si una fecha está vigente.
     */
    static estaVigente(desde: Date,hasta: Date): boolean {

        const hoy = new Date();

        return hoy >= desde && hoy <= hasta;
    }

    /**
     * Calcula el tipo de vigencia.
     */
    static obtenerTipoVigencia(desde: Date,hasta: Date): TipoVigencia {

        const dias = this.diasEntre(desde, hasta);

        if (Math.abs(dias - 30) <= 2) {
            return TipoVigencia.MENSUAL;
        }

        if (Math.abs(dias - 60) <= 2) {
            return TipoVigencia.BIMESTRAL;
        }

        if (Math.abs(dias - 90) <= 2) {
            return TipoVigencia.TRIMESTRAL;
        }

        if (Math.abs(dias - 120) <= 2) {
            return TipoVigencia.CUATRIMESTRAL;
        }

        if (Math.abs(dias - 180) <= 2) {
            return TipoVigencia.SEMESTRAL;
        }

        if (Math.abs(dias - 365) <= 3) {
            return TipoVigencia.ANUAL;
        }

        return TipoVigencia.OTRA;
    }


    

    




}