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


    /**
     *  Convierte un string YYYY-MM-DD a Date, validando que sea una fecha válida.
     * @param valor  
     * @param campo 
     * @returns 
     */
    static parsearFecha(valor: string,campo: string): Date {

        if (!valor?.trim()) {
            throw new Error(`RUS no informó ${campo}.`);
        }

        const fecha = new Date(`${valor.substring(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            throw new Error(`Fecha inválida en ${campo}: ${valor}`);
        }

        return fecha;
    }

    /**
     *  Convierte un string YYYY-MM-DD a Date, validando que sea una fecha válida.
     *  Si no es válida, retorna la fecha de fallback.
     * @param valor valor a parsear  
     * @param fallback fecha de fallback a retornar si el valor no es válido 
     * @returns fecha parseada o fecha de fallback si el valor no es válido 
     */
    static parsearFechaConFallback(valor: string | null | undefined,fallback: Date): Date {

        if (!valor?.trim()) {
            return new Date(
                fallback.getTime()
            );
        }

        const fecha = new Date(`${valor.substring(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            return new Date(fallback.getTime());
        }

        return fecha;
    }


    /**
     *  Calcula la cantidad de días que faltan para vencer desde hoy.
     * @param fechaHasta fecha de vencimiento 
     * @returns retorna la cantidad de días que faltan para vencer desde hoy. Si la fecha ya pasó, retorna un número negativo.
     */
    static calcularDiasParaVencer(fechaHasta: Date): number {

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const hasta = new Date(fechaHasta);
        hasta.setHours(0, 0, 0, 0);

        const diferencia = hasta.getTime() - hoy.getTime();

        return Math.ceil(diferencia /(1000 * 60 * 60 * 24));
    }
    


    /**
     * Calcula el tipo de vigencia según la cantidad de días entre dos fechas. 
     * @param desde desde fecha de inicio de vigencia 
     * @param hasta hasta fecha de fin de vigencia
     * @returns retorna el tipo de vigencia según la cantidad de días entre las fechas.
     *  Si la cantidad de días no coincide con ningún tipo de vigencia, retorna TipoVigencia.OTRA.
     */
    static calcularTipoVigencia(desde: Date, hasta: Date): TipoVigencia {

        const dias = Math.round(( hasta.getTime() - desde.getTime()) /(1000 * 60 * 60 * 24));

        if (dias <= 35) {
            return TipoVigencia.MENSUAL;
        }

        if (dias <= 70) {
            return TipoVigencia.BIMESTRAL;
        }

        if (dias <= 100) {
            return TipoVigencia.TRIMESTRAL;
        }

        if (dias <= 135) {
            return TipoVigencia.CUATRIMESTRAL;
        }

        if (dias <= 200) {
            return TipoVigencia.SEMESTRAL;
        }

        if (dias <= 380) {
            return TipoVigencia.ANUAL;
        }

        return TipoVigencia.OTRA;
    }

    /**
     * Formatea una duración en milisegundos a un string legible en horas, minutos y segundos. 
     * @param milisegundos La duración en milisegundos a formatear.
     * @returns Un string representando la duración en el formato "Xh Ym Zs" o "Ym Zs" si no hay horas.
     */
    static  formatearDuracion(milisegundos: number): string {

        const segundosTotales = Math.floor(milisegundos / 1000);
        const horas = Math.floor(segundosTotales / 3600);
        const minutos = Math.floor(( segundosTotales % 3600 ) / 60);
        const segundos = segundosTotales % 60;

        if (horas > 0) {
            return (`${horas}h ` +`${minutos}m ` +`${segundos}s`);
        }

        return (`${minutos}m ` +`${segundos}s`);
    }



}