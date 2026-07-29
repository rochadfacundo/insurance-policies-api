import { esperar, formatearFecha, generarRangoFechas, obtenerMensajeError } from "../../../utils/utils";
import { RusPropuesta, RusPropuestasRequest, RusPropuestasResponse } from "../models/rusPropuestasInterfaces";
import { RusPropuestasManager } from "../models/rusPropuestasManager";
import { obtenerDetallePropuesta, obtenerPropuestas } from "./rusPropuestasService";


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
     * Crea un RusPropuestasManager a partir de una lista acumulada.
     * Asume que las propuestas ya fueron filtradas por fecha y productor.
     * No realiza llamadas adicionales, solo formatea la respuesta para el manager.
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
     * Obtiene el detalle completo de una propuesta.
     */
    async obtenerDetalleDePropuesta(prop: RusPropuesta): Promise<any> {
        return await obtenerDetallePropuesta(prop.numeroSeccion, prop.propuesta, prop.endoso,prop.renovacion);
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

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
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

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
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
    async obtenerCarteraPorRango(productor: number, fechaDesde: string, fechaHasta: string): Promise<RusPropuestasManager> {
    
        const fechas = generarRangoFechas(fechaDesde,fechaHasta);
    
        const propuestasAcumuladas: RusPropuesta[] = [];

        for (const fecha of fechas) {
    
            try {
    
                const response = await this.obtenerPorFecha(productor,fecha);
    
                    if (!Array.isArray(response?.results)) {

                        throw new Error(
                            `Respuesta inválida de RUS. ` +
                            `Productor: ${productor}. ` +
                            `Fecha: ${fecha}. ` +
                            `Respuesta: ${JSON.stringify(response)}`
                        );
                    }
    
                propuestasAcumuladas.push(
                    ...response.results
                );
    
            } catch (error: any) {

                const status = error?.response?.status;
            
                const detalle = error?.response?.data;
            
                throw new Error(
                    `Error consultando RUS. ` +
                    `Productor: ${productor}. ` +
                    `Fecha: ${fecha}. ` +
                    `Status: ${status ?? "sin status"}. ` +
                    `Detalle: ${detalle
                            ? JSON.stringify(detalle)
                            : error?.message
                    }`
                );
            }
        }
    
        const propuestasSinDuplicados = this.eliminarDuplicados(propuestasAcumuladas);
    
        return this.crearManagerDesdePropuestas(propuestasSinDuplicados);
    }

    /**
     * Obtiene todas las páginas de propuestas
     * de un productor para una fecha puntual.
     */
    async obtenerPorFecha(productor: number, fechaEmision: string): Promise<RusPropuestasResponse> {

        const propuestasAcumuladas: RusPropuesta[] = [];

        let pagina = this.defaultPagina;

        let totalEsperado: number | null = null;

        while (totalEsperado === null || propuestasAcumuladas.length < totalEsperado) {

            const request: RusPropuestasRequest = {
                codigoProductor: [productor],
                fechaEmision,
                pagina
            };

            const response = await this.obtenerPropuestasConReintento(request, productor,fechaEmision, pagina);

            if (!response || !response.paging || !Array.isArray(response.results)) {
                throw new Error(
                    `Respuesta paginada inválida de RUS. ` +
                    `Productor: ${productor}. ` +
                    `Fecha: ${fechaEmision}. ` +
                    `Página: ${pagina}. ` +
                    `Respuesta: ${JSON.stringify(response)}`
                );
            }

            if (totalEsperado === null) {
                totalEsperado = response.paging.total;
            }

            propuestasAcumuladas.push(...response.results);

            if (response.results.length === 0 && propuestasAcumuladas.length < totalEsperado) {
                throw new Error(
                    `RUS informó ${totalEsperado} propuestas, ` +
                    `pero la página ${pagina} vino vacía. ` +
                    `Productor: ${productor}. ` +
                    `Fecha: ${fechaEmision}.`
                );
            }

            pagina++;
        }

        return {
            paging: {
                total: propuestasAcumuladas.length,
                limit: propuestasAcumuladas.length,
                offset: 0
            },
            results: propuestasAcumuladas
        };
    }

    /*
 * Obtiene propuestas con reintentos en caso de error.
 * Limita la cantidad de intentos para evitar bucles infinitos.
 */
private async obtenerPropuestasConReintento(
    request: RusPropuestasRequest,
    productor: number,
    fechaEmision: string,
    pagina: number
): Promise<RusPropuestasResponse> {

    const MAX_INTENTOS = 5;

    const demorasMs = [
        15_000,
        30_000,
        60_000,
        120_000
    ];

    let ultimoError: unknown;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {

            const response = await obtenerPropuestas(request);

            if (response && response.paging && Array.isArray(response.results)) {
                return response;
            }

            throw new Error(`Respuesta inválida: ${JSON.stringify(response)}`);

        } catch (error) {

            ultimoError = error;

            if (intento >= MAX_INTENTOS) {
                break;
            }

            const demora = demorasMs[intento - 1]   ?? 120_000;

            console.warn(
                `RUS falló. ` +
                `Reintentando en ${demora / 1000}s. ` +
                `Intento ${intento}/${MAX_INTENTOS}. ` +
                `Productor: ${productor}. ` +
                `Fecha: ${fechaEmision}. ` +
                `Página: ${pagina}. ` +
                `Error: ${obtenerMensajeError(error)}`
            );

            await esperar(demora);
        }
    }

    throw new Error(
        `RUS falló luego de ${MAX_INTENTOS} intentos. ` +
        `Productor: ${productor}. ` +
        `Fecha: ${fechaEmision}. ` +
        `Página: ${pagina}. ` +
        `Error: ${obtenerMensajeError(ultimoError)}`
    );
}



    
    /**
     * Obtiene cartera de los últimos X meses.
     */
    async obtenerUltimosMeses(productor: number,meses: number): Promise<RusPropuestasManager> {

        const hasta = new Date();
        const desde = new Date();

        desde.setMonth(desde.getMonth() - meses);

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
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


}