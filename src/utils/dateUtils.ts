import { TipoVigencia } from "../models/tipoVigencia";

export class DateUtils {


    


    /**
 * Convierte una fecha Date al formato dd/MM/yyyy.
 *
 * Este formato es utilizado, entre otros casos, por los endpoints
 * diarios de cartera de Federación Patronal.
 *
 * @param fecha Fecha a formatear.
 * @returns Fecha en formato dd/MM/yyyy.
 */
static formatearFechaDDMMYYYY(fecha: Date): string {

    const dia =
        String(fecha.getDate())
            .padStart(2, "0");

    const mes =
        String(fecha.getMonth() + 1)
            .padStart(2, "0");

    const anio =
        fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
}



    /**
     * Genera un arreglo de fechas en formato dd/MM/yyyy 
     * @param desde Desde fecha de inicio en formato dd/MM/yyyy  
     * @param hasta Hasta fecha de fin en formato dd/MM/yyyy
     * @returns Arreglo de fechas en formato dd/MM/yyyy entre desde y hasta, inclusive. 
     */
    static generarFechas(desde: string,hasta: string): string[] {

        const fechaDesde =
            DateUtils.parsearFechaDDMMYYYY(
                desde
            );

        const fechaHasta =
            DateUtils.parsearFechaDDMMYYYY(
                hasta
            );

        if (
            fechaDesde.getTime() >
            fechaHasta.getTime()
        ) {
            throw new Error(
                "FECHA_DESDE no puede ser posterior a FECHA_HASTA."
            );
        }

        const fechas: string[] = [];

        const actual =
            new Date(fechaDesde);

        while (
            actual.getTime() <=
            fechaHasta.getTime()
        ) {

            fechas.push(
                DateUtils.formatearFechaDDMMYYYY(
                    actual
                )
            );

            actual.setDate(
                actual.getDate() + 1
            );
        }

        return fechas;
    }

    /**
     * Determina si una fecha de vigencia ya finalizó respecto
     * de la fecha actual.
     *
     * La comparación se realiza a nivel calendario, ignorando
     * la hora para evitar diferencias producidas por timezone.
     *
     * @param fechaHasta fecha final en formato YYYY-MM-DD.
     * @returns true cuando la fecha de vigencia es anterior al día actual.
     */
    static estaVencida(fechaHasta: string): boolean {

        const [anioTexto, mesTexto, diaTexto] = fechaHasta.split("-");

        const anio = Number(anioTexto);
        const mes = Number(mesTexto);
        const dia = Number(diaTexto);

        if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) {
            return false;
        }

        const fechaFin = new Date(
            anio,
            mes - 1,
            dia
        );

        fechaFin.setHours(0, 0, 0, 0);

        const hoy = new Date();

        hoy.setHours(0, 0, 0, 0);

        return fechaFin.getTime() < hoy.getTime();
    }


    /**
     * Formatea cantidades enteras utilizando separadores locales.
     *
     * Se utiliza únicamente para mejorar la legibilidad de los logs
     * del proceso.
     */
    static formatearNumero(valor: number): string {

        return valor.toLocaleString("es-AR");
    }



    /**
     * Convierte una fecha en formato dd/MM/yyyy a Date.
     *
     * La fecha se construye utilizando sus componentes numéricos
     * para evitar depender de Date.parse() con formatos regionales.
     *
     * @param fecha Fecha en formato dd/MM/yyyy.
     * @returns Fecha convertida a Date.
     */
    static parsearFechaDDMMYYYY(fecha: string): Date {

        const partes =
            fecha.split("/");

        if (partes.length !== 3) {
            throw new Error(
                `Formato de fecha inválido: ${fecha}`
            );
        }

        const dia =
            Number(partes.at(0));

        const mes =
            Number(partes.at(1));

        const anio =
            Number(partes.at(2));

        if (
            !Number.isInteger(dia) ||
            !Number.isInteger(mes) ||
            !Number.isInteger(anio)
        ) {
            throw new Error(
                `Formato de fecha inválido: ${fecha}`
            );
        }

        const resultado =
            new Date(
                anio,
                mes - 1,
                dia
            );

        /*
        * Verificamos nuevamente los componentes porque JavaScript
        * normaliza automáticamente fechas inexistentes.
        *
        * Por ejemplo, new Date(2026, 1, 31) termina representando
        * una fecha de marzo en lugar de lanzar un error.
        */
        if (
            resultado.getFullYear() !== anio ||
            resultado.getMonth() !== mes - 1 ||
            resultado.getDate() !== dia
        ) {
            throw new Error(
                `Fecha inválida: ${fecha}`
            );
        }

        return resultado;
    }


    /**
     * Resta una cantidad determinada de días a una fecha expresada
     * en formato dd/MM/yyyy.
     *
     * @param fecha Fecha base en formato dd/MM/yyyy.
     * @param dias Cantidad de días a restar.
     * @returns Fecha resultante en formato dd/MM/yyyy.
     */
    static restarDiasDDMMYYYY(fecha: string,dias: number): string {

        const resultado = this.parsearFechaDDMMYYYY(fecha);

        resultado.setDate(resultado.getDate() - dias);

        return this.formatearFechaDDMMYYYY(resultado);
    }

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
 * Obtiene el nombre del mes siguiente a la fecha de referencia.
 *
 * Ejemplo:
 * 20/09/2026 -> "Octubre 2026"
 * 20/12/2026 -> "Enero 2027"
 */
static obtenerMesRenovacion(fechaReferencia: Date): string {

    const mesSiguiente = new Date(
        fechaReferencia.getFullYear(),
        fechaReferencia.getMonth() + 1,
        1
    );

    const texto = mesSiguiente.toLocaleDateString(
        "es-AR",
        {
            month: "long",
            year: "numeric"
        }
    );

    return (
        texto.charAt(0).toUpperCase() +
        texto.slice(1)
    );
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