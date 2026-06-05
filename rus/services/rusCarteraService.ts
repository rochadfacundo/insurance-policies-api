import { RusPropuesta, RusPropuestasRequest, RusPropuestasResponse } from "../models/rusPropuestasInterfaces";
import { RusPropuestasManager } from "../models/rusPropuestasManager";
import { obtenerPropuestas } from "./rusPropuestasService";


/**
 * Servicio encargado de reconstruir una cartera de RUS
 * consultando propuestas emitidas dentro de un rango de fechas.
 *
 * Responsabilidades:
 * - Consultar propuestas por fecha de emisión.
 * - Recorrer rangos de fechas.
 * - Acumular propuestas de uno o varios productores.
 * - Eliminar propuestas duplicadas.
 * - Construir un RusPropuestasManager con la cartera acumulada.
 *
 * Esta clase realiza llamadas HTTP mediante RusPropuestasService.
 */
export class RusCarteraService {

    private readonly defaultPagina: number;

    constructor(defaultPagina: number = 0) {
        this.defaultPagina = defaultPagina;
    }

    /**
     * Obtiene cartera de un año específico.
     */
    async obtenerPorAnio(productor: number,anio: number): Promise<RusPropuestasManager> {

        return await this.obtenerCarteraPorRango(productor,`${anio}-01-01`,`${anio}-12-31`);
    }

    /**
     * Obtiene cartera de los últimos X días.
     */
    async obtenerUltimosDias(productor: number, dias: number): Promise<RusPropuestasManager> {

        const hasta = new Date();

        const desde = new Date();

        desde.setDate(desde.getDate() - dias);

        return await this.obtenerCarteraPorRango(productor,this.formatearFecha(desde),this.formatearFecha(hasta));
    }

    /**
     * Obtiene cartera de los últimos 30 días.
     */
    async obtenerUltimos30Dias(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosDias(productor,30);
    }

    /**
     * Obtiene cartera de los últimos 7 días.
     */
    async obtenerUltimaSemana(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosDias(productor,  7);
    }

    /**
     * Obtiene cartera de un mes específico.
     */
    async obtenerPorMes(productor: number,anio: number,mes: number): Promise<RusPropuestasManager> {

        const desde = new Date(anio, mes - 1, 1);

        const hasta = new Date(anio, mes, 0);

        return await this.obtenerCarteraPorRango(productor,this.formatearFecha(desde),this.formatearFecha(hasta));
    }

    /**
     * Obtiene la cartera acumulada de varios productores.
     */
    async obtenerCarteraProductores(productores: number[],fechaDesde: string,fechaHasta: string): Promise<RusPropuestasManager> {

        const propuestas: RusPropuesta[] = [];

        for (const productor of productores) {

            const manager = await this.obtenerCarteraPorRango(productor,fechaDesde,fechaHasta);

            propuestas.push(...manager.getPropuestas());
        }

        const propuestasSinDuplicados = this.eliminarDuplicados(propuestas);

        return this.crearManagerDesdePropuestas(propuestasSinDuplicados);
    }



    /**
     * Obtiene cartera para un productor dentro de un rango de fechas.
     */
    async obtenerCarteraPorRango(productor: number,fechaDesde: string,fechaHasta: string): Promise<RusPropuestasManager> {

        const fechas = this.generarRangoFechas(fechaDesde, fechaHasta);
        const propuestasAcumuladas: RusPropuesta[] = [];

        for (const fecha of fechas) {

            const response = await this.obtenerPorFecha(productor, fecha);

            propuestasAcumuladas.push(...response.results);
        }

        const propuestasSinDuplicados = this.eliminarDuplicados(propuestasAcumuladas);

        return this.crearManagerDesdePropuestas(propuestasSinDuplicados);
    }

    /**
     * Obtiene propuestas de un productor para una fecha puntual.
     */
    async obtenerPorFecha(productor: number,fechaEmision: string): Promise<RusPropuestasResponse> {

        const request: RusPropuestasRequest = {
            codigoProductor: [productor],
            fechaEmision,
            pagina: this.defaultPagina
        };

        return await obtenerPropuestas(request);
    }

    /**
     * Obtiene cartera de los últimos X meses.
     */
    async obtenerUltimosMeses(productor: number,meses: number): Promise<RusPropuestasManager> {

        const hasta = new Date();
        const desde = new Date();

        desde.setMonth(desde.getMonth() - meses);

        return await this.obtenerCarteraPorRango(productor,this.formatearFecha(desde),this.formatearFecha(hasta));
    }

    /**
     * Obtiene cartera de los últimos 6 meses.
     */
    async obtenerUltimos6Meses(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosMeses(productor, 6);
    }

    /**
     * Obtiene cartera del último año.
     */
    async obtenerUltimoAnio(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosMeses(productor, 12);
    }

    /**
     * Genera un arreglo de fechas entre fechaDesde y fechaHasta.
     */
    private generarRangoFechas(fechaDesde: string,fechaHasta: string): string[] {

        const fechas: string[] = [];

        const actual = new Date(`${fechaDesde}T00:00:00`);
        const hasta = new Date(`${fechaHasta}T00:00:00`);

        while (actual <= hasta) {
            fechas.push(this.formatearFecha(actual));
            actual.setDate(actual.getDate() + 1);
        }

        return fechas;
    }

    /**
     * Elimina propuestas duplicadas.
     * Prioriza numeroPoliza y, si no existe, usa id.
     */
    private eliminarDuplicados(propuestas: RusPropuesta[]): RusPropuesta[] {

        const map = new Map<string, RusPropuesta>();

        for (const propuesta of propuestas) {

            const key =
                propuesta.numeroPoliza
                    ? `poliza-${propuesta.numeroPoliza}`
                    : `id-${propuesta.id}`;

            map.set(key, propuesta);
        }

        return Array.from(map.values());
    }

    /**
     * Crea un RusPropuestasManager a partir de una lista acumulada.
     */
    private crearManagerDesdePropuestas(propuestas: RusPropuesta[]): RusPropuestasManager {

        const response: RusPropuestasResponse = {
            paging: {
                total: propuestas.length,
                limit: propuestas.length,
                offset: 0
            },
            results: propuestas
        };

        return new RusPropuestasManager(response);
    }

    /**
     * Convierte Date a formato YYYY-MM-DD.
     */
    private formatearFecha(fecha: Date): string {
    
        const fechaFormateada = fecha.toISOString().split("T")[0];
    
        if (!fechaFormateada) {
            throw new Error("No se pudo formatear la fecha");
        }
    
        return fechaFormateada;
    }
}