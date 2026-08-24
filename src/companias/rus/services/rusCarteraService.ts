import { esperar, formatearDuracion, formatearFecha, generarRangoFechas, obtenerMensajeError } from "../../../utils/utils";
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

    /**
     * Número de página por defecto para las consultas a RUS.
     */
    private readonly defaultPagina: number;

    /**
     * Crea una instancia de RusCarteraService. 
     * Recibe un parámetro opcional para establecer el número de página por defecto para las consultas a RUS.
     * @param defaultPagina número de página por defecto para las consultas a RUS (opcional, por defecto es 0). 
     */
    constructor(defaultPagina: number = 0) {
        this.defaultPagina = defaultPagina;
    }


    /**
     * Crea un RusPropuestasManager a partir de un array de propuestas. 
     * @param propuestas propuestas a incluir en el manager.  
     * @returns Un RusPropuestasManager con las propuestas proporcionadas. 
     * @see RusPropuestasManager 
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
     * Obtiene el detalle de una propuesta específica. 
     * @param prop propuesta de la cual se desea obtener el detalle. 
     * @returns Un objeto con el detalle de la propuesta, tal como lo devuelve RUS. 
     * @see RusPropuestasManager 
    */
    async obtenerDetalleDePropuesta(prop: RusPropuesta): Promise<any> {
        return await obtenerDetallePropuesta(prop.numeroSeccion, prop.propuesta, prop.endoso,prop.renovacion);
    }


    /**
     * Obtiene cartera de un año específico. 
     * @param productor productor del cual se desea obtener la cartera.      
     * @param anio año del cual se desea obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en el año especificado. 
     * @see RusPropuestasManager 
    */
    async obtenerPorAnio(productor: number,anio: number): Promise<RusPropuestasManager> {

        return await this.obtenerCarteraPorRango(productor,`${anio}-01-01`,`${anio}-12-31`);
    }

    /**
     * Obtiene cartera de los últimos X días. 
     * @param productor productor del cual se desea obtener la cartera. 
     * @param dias cantidad de días hacia atrás desde la fecha actual para obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos X días. 
     * @see RusPropuestasManager 
    */
    async obtenerUltimosDias(productor: number, dias: number): Promise<RusPropuestasManager> {

        const hasta = new Date();
        const desde = new Date();

        desde.setDate(desde.getDate() - dias);

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
    }



    /**
     * Obtiene cartera de los últimos 30 días. 
     * @param productor productor del cual se desea obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos 30 días. 
     * @see RusPropuestasManager 
    */
    async obtenerUltimos30Dias(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosDias(productor,30);
    }

    /**
     * Obtiene cartera de la última semana (7 días). 
     * @param productor productor del cual se desea obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos 7 días.
     * @see RusPropuestasManager 
    */
    async obtenerUltimaSemana(productor: number): Promise<RusPropuestasManager> {

        return await this.obtenerUltimosDias(productor,  7);
    }

    /**
     * Obtiene cartera de un mes específico. 
     * @param productor productor del cual se desea obtener la cartera. 
     * @param anio año del cual se desea obtener la cartera. 
     * @param mes mes del cual se desea obtener la cartera (1-12). 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en el mes especificado. 
     * @see RusPropuestasManager 
    */
    async obtenerPorMes(productor: number,anio: number,mes: number): Promise<RusPropuestasManager> {

        const desde = new Date(anio, mes - 1, 1);
        const hasta = new Date(anio, mes, 0);

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
    }

    /**
     * Obtiene cartera de varios productores dentro de un rango de fechas. 
     * @param productores array de productores de los cuales se desea obtener la cartera. 
     * @param fechaDesde fecha inicial del rango (inclusive) en formato YYYY-MM-DD. 
     * @param fechaHasta fecha final del rango (inclusive) en formato YYYY-MM-DD. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por los productores en el rango de fechas especificado. 
     * @see RusPropuestasManager 
    */
    async obtenerCarteraProductores(productores: number[],fechaDesde: string,fechaHasta: string): Promise<RusPropuestasManager> {

        const propuestas: RusPropuesta[] = [];

        for (const productor of productores) {

            const manager = await this.obtenerCarteraPorRango(productor,fechaDesde,fechaHasta);

            propuestas.push(...manager.getPropuestas());
        }

        const propuestasSinDuplicados = await this.consolidarPropuestas(propuestas);

        return this.crearManagerDesdePropuestas(propuestasSinDuplicados);
    }

    /**
     * Obtiene cartera de un productor dentro de un rango de fechas.
     * @param productor  productor del cual se desea obtener la cartera.
     * @param fechaDesde fecha inicial del rango (inclusive) en formato YYYY-MM-DD. 
     * @param fechaHasta fecha final del rango (inclusive) en formato YYYY-MM-DD. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en el rango de fechas especificado. 
     * @see RusPropuestasManager 
    */
    async obtenerCarteraPorRango(productor: number, fechaDesde: string, fechaHasta: string): Promise<RusPropuestasManager> {
    
        //debug trazo
        const inicioTotal = Date.now();

        const fechas = generarRangoFechas(fechaDesde,fechaHasta);
    
        const propuestasAcumuladas: RusPropuesta[] = [];


        let fechasProcesadas = 0;
        let fechasConResultados = 0;
        let fechasSinResultados = 0;
        let totalResultados = 0;

        let duracionAcumuladaRequestsMs = 0;
        let requestMasLentoMs = 0;
        let fechaRequestMasLento: string | null = null;

        /* vieja logica secuencial
        for (const fecha of fechas) {

            //debug trazo1
            const inicioRequest = Date.now();
    
            try {
    
                const response = await this.obtenerPorFecha(productor,fecha);

                //debug trazo2
                const duracionRequest = Date.now() - inicioRequest;
                duracionAcumuladaRequestsMs += duracionRequest;
                fechasProcesadas++;

                if (duracionRequest > requestMasLentoMs) {
                    requestMasLentoMs = duracionRequest;
                    fechaRequestMasLento = fecha;
                }
    
    
                    if (!Array.isArray(response?.results)) {

                        throw new Error(
                            `Respuesta inválida de RUS. ` +
                            `Productor: ${productor}. ` +
                            `Fecha: ${fecha}. ` +
                            `Respuesta: ${JSON.stringify(response)}`
                        );
                    }

                const cantidadResultados = response.results.length;
                totalResultados += cantidadResultados;
    
                if (cantidadResultados > 0) {
                    fechasConResultados++;
                    propuestasAcumuladas.push(...response.results);
                } else {
                    fechasSinResultados++;
                }

                    
             // Evitamos imprimir las 365 fechas vacías.
             // Solo mostramos fechas con resultados
             // o requests particularmente lentos.
             
            if (cantidadResultados > 0 || duracionRequest >= 10_000) {
                console.log({
                    fecha,
                    resultados: cantidadResultados,
                    duracionMs: duracionRequest
                });
            }
    
            } catch (error: any) {

                //debug trazo3
                const duracionRequest = Date.now() - inicioRequest;

                const status = error?.response?.status;
                const detalle = error?.response?.data;

                //debug trazo3.5
                console.error({
                    productor,
                    fecha,
                    duracionMs: duracionRequest,
                    status: status ?? "sin status",
                    detalle: detalle ?? error?.message ?? "Error desconocido"
                });
            
                throw new Error(
                    `Error consultando RUS. ` +
                    `Productor: ${productor}. ` +
                    `Fecha: ${fecha}. ` +
                    `Status: ${status ?? "sin status"}. ` +
                    `Detalle: ${detalle ? JSON.stringify(detalle) : error?.message}`
                );
            }
        }*/

        // Nueva logica concurrente
        const CONCURRENCIA_RUS =12;

        for (let indice = 0;indice < fechas.length;indice += CONCURRENCIA_RUS) {
            const loteFechas = fechas.slice(indice,indice + CONCURRENCIA_RUS);

            const resultadosLote = await Promise.all(loteFechas.map(async fecha => {

                    const inicioRequest = Date.now();

                    try {
                        const response = await this.obtenerPorFecha(productor,fecha);

                        const duracionRequest = Date.now() - inicioRequest;

                        if (!Array.isArray(response?.results)) {
                            throw new Error(`Respuesta inválida de RUS. ` +
                                `Productor: ${productor}. ` +
                                `Fecha: ${fecha}. ` +
                                `Respuesta: ${JSON.stringify(response)}`
                            );
                        }

                        return {
                            fecha,
                            resultados: response.results,
                            duracionRequest
                        };

                    } catch (error: any) {
                        const duracionRequest = Date.now() - inicioRequest;

                        const status = error?.response?.status;

                        const detalle = error?.response?.data;

                        throw new Error(
                            `Error consultando RUS. ` +
                            `Productor: ${productor}. ` +
                            `Fecha: ${fecha}. ` +
                            `Duración: ${duracionRequest} ms. ` +
                            `Status: ${status ?? "sin status"}. ` +
                            `Detalle: ${detalle ? JSON.stringify(detalle) : error?.message}`);
                    }
                })
            );

            for (const resultado of resultadosLote) {
                const {
                    fecha,resultados,duracionRequest} = resultado;

                duracionAcumuladaRequestsMs += duracionRequest;
                fechasProcesadas++;

                if (duracionRequest > requestMasLentoMs) {
                    requestMasLentoMs = duracionRequest;
                    fechaRequestMasLento = fecha;
                }

                const cantidadResultados = resultados.length;

                totalResultados += cantidadResultados;

                if (cantidadResultados > 0) {
                    fechasConResultados++;

                    propuestasAcumuladas.push(...resultados);
                } else {
                    fechasSinResultados++;
                }

                if (cantidadResultados > 0 || duracionRequest >= 10_000) {
                    console.log({
                        fecha,
                        resultados: cantidadResultados,
                        duracionMs: duracionRequest
                    });
                }
            }

            console.log(`Progreso RUS: ${Math.min(indice + CONCURRENCIA_RUS,fechas.length)}/${fechas.length} fechas`);
        }



        //debug trazo4
        const inicioDuplicados = Date.now();
    
        const propuestasSinDuplicados = await this.consolidarPropuestas(propuestasAcumuladas);

        //debug trazo5
        const duracionEliminarDuplicados = Date.now() - inicioDuplicados;
        const duracionTotal = Date.now() - inicioTotal;

        const promedioRequestMs = fechasProcesadas > 0 ? Math.round(duracionAcumuladaRequestsMs /fechasProcesadas): 0;

        console.log("");
        console.log("==================================================");
        console.log("MÉTRICAS RUS CARTERA");
        console.log("==================================================");

        console.log({
            productor,
            fechaDesde,
            fechaHasta,
            fechasTotales: fechas.length,
            fechasProcesadas,
            fechasConResultados,
            fechasSinResultados,
            totalResultados,
            propuestasSinDuplicados: propuestasSinDuplicados.length,
            promedioRequestMs,
            requestMasLentoMs,
            fechaRequestMasLento,
            duracionAcumuladaRequestsMs: formatearDuracion(duracionAcumuladaRequestsMs),
            duracionEliminarDuplicados: formatearDuracion(duracionEliminarDuplicados),
            duracionTotal: formatearDuracion(duracionTotal)
        });
    
        return this.crearManagerDesdePropuestas(propuestasSinDuplicados);
    }

    /**
     * Obtiene propuestas de un productor en una fecha específica. 
     * @param productor productor del cual se desea obtener las propuestas. 
     * @param fechaEmision fecha de emisión de las propuestas a obtener en formato YYYY-MM-DD. 
     * @returns Un RusPropuestasResponse con las propuestas emitidas por el productor en la fecha especificada. 
     * @see RusPropuestasManager 
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

    /**
     * Obtiene propuestas de RUS con reintentos en caso de error. 
     * @param request request de tipo RusPropuestasRequest que contiene los parámetros de la consulta.    
     * @param productor productor del cual se desea obtener las propuestas. 
     * @param fechaEmision fecha de emisión de las propuestas a obtener en formato YYYY-MM-DD. 
     * @param pagina página de resultados a obtener. 
     * @returns Un RusPropuestasResponse con las propuestas emitidas por el productor en la fecha especificada y página indicada. 
     * @see RusPropuestasManager 
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
     * @param productor productor del cual se desea obtener la cartera. 
     * @param meses meses hacia atrás desde la fecha actual para obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos X meses. 
     * @see RusPropuestasManager 
    */
    async obtenerUltimosMeses(productor: number,meses: number): Promise<RusPropuestasManager> {

        const hasta = new Date();
        const desde = new Date();

        desde.setMonth(desde.getMonth() - meses);

        return await this.obtenerCarteraPorRango(productor,formatearFecha(desde),formatearFecha(hasta));
    }

    /**
     * Obtiene cartera de los últimos 6 meses. 
     * @param productor productor del cual se desea obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos 6 meses. 
     * @see RusPropuestasManager 
    */
    async obtenerUltimos6Meses(productor: number): Promise<RusPropuestasManager> {
        return await this.obtenerUltimosMeses(productor, 6);
    }

    /**
     * Obtiene cartera de los últimos 12 meses (1 año). 
     * @param productor productor del cual se desea obtener la cartera. 
     * @returns Un RusPropuestasManager con las propuestas emitidas por el productor en los últimos 12 meses. 
     * @see RusPropuestasManager 
    */
    async obtenerUltimoAnio(productor: number): Promise<RusPropuestasManager> {
        return await this.obtenerUltimosMeses(productor, 12);
    }

    

    /**
     * Elimina duplicados de un array de propuestas, 
     * conservando la propuesta vigente o la de mayor endoso en caso de existir duplicados.
     * @param propuestas array de propuestas a consolidar.
     * @returns Un array de propuestas sin duplicados, conservando la propuesta vigente 
     * o la de mayor endoso en caso de existir duplicados.
     * @see RusPropuesta
     */
    private async consolidarPropuestas(
        propuestas: RusPropuesta[]
    ): Promise<RusPropuesta[]> {
    
        const grupos = new Map<string, RusPropuesta[]>();
    
        /**
         * Agrupamos todas las apariciones de una misma póliza.
         */
        for (const propuesta of propuestas) {
    
            const key =
                propuesta.numeroPoliza
                    ? `poliza-${propuesta.numeroPoliza}`
                    : `id-${propuesta.id}`;
    
            const grupo = grupos.get(key) ?? [];
    
            grupo.push(propuesta);
    
            grupos.set(key, grupo);
        }
    
    
        const propuestasConsolidadas: RusPropuesta[] = [];
    
    
        for (const grupo of grupos.values()) {
    
            if (grupo.length === 0) {
                continue;
            }
    
    
            /**
             * Preferimos siempre el registro que RUS marca
             * actualmente como VIGENTE.
             */
            const vigente = grupo.find(
                propuesta =>
                    propuesta.vigenciaEstado
                        ?.trim()
                        .toUpperCase() === "VIGENTE"
            );
    
    
            /**
             * Si no existe uno marcado como vigente,
             * utilizamos el de mayor endoso.
             */
            const mayorEndoso = [...grupo]
                .sort(
                    (a, b) =>
                        Number(b.endoso ?? 0) -
                        Number(a.endoso ?? 0)
                )[0]!;
    
    
            const actual: RusPropuesta =
                vigente ?? mayorEndoso;
    
    
            /**
             * Primero intentamos encontrar el endoso 0
             * dentro del propio rango consultado.
             *
             * Esto ocurre normalmente durante un BOOTSTRAP.
             */
            const endosoInicial = grupo.find(
                propuesta =>
                    Number(propuesta.endoso ?? 0) === 0
            );
    
    
            let premioPoliza: number | undefined;
    
    
            /**
             * CASO 1
             *
             * Tenemos el endoso 0 dentro de la cartera.
             */
            if (endosoInicial) {
    
                const premioInicial =
                    Number(endosoInicial.premio ?? 0);
    
                if (
                    Number.isFinite(premioInicial) &&
                    premioInicial > 0
                ) {
                    premioPoliza = premioInicial;
                }
            }
    
    
            /**
             * CASO 2
             *
             * No tenemos el endoso 0.
             *
             * Esto es justamente lo que puede ocurrir durante
             * una sincronización INCREMENTAL.
             *
             * Como conocemos:
             *
             * - sección
             * - propuesta
             * - renovación
             *
             * podemos pedir directamente a RUS el detalle
             * del endoso 0.
             */
            if (
                premioPoliza === undefined &&
                Number(actual.endoso ?? 0) > 0
            ) {
    
                try {
    
                    console.log(
                        `Recuperando endoso inicial RUS: ` +
                        `póliza ${actual.numeroPoliza}, ` +
                        `endoso actual ${actual.endoso}`
                    );
    
    
                    const detalleInicial =
                        await obtenerDetallePropuesta(
                            actual.numeroSeccion,
                            actual.propuesta,
                            0,
                            actual.renovacion
                        );
    
    
                    const premioInicial =
                        Number(detalleInicial?.premio ?? 0);
    
    
                    if (
                        Number.isFinite(premioInicial) &&
                        premioInicial > 0
                    ) {
    
                        premioPoliza =
                            premioInicial;
    
    
                        console.log({
                            poliza:
                                actual.numeroPoliza,
    
                            endosoActual:
                                actual.endoso,
    
                            premioEndoso:
                                actual.premio,
    
                            premioPoliza
                        });
    
                    } else {
    
                        console.warn(
                            `RUS no informó un premio válido ` +
                            `para el endoso inicial de la póliza ` +
                            `${actual.numeroPoliza}.`
                        );
                    }
    
    
                } catch (error) {
    
                    console.warn(
                        `No se pudo recuperar el endoso inicial ` +
                        `de la póliza ${actual.numeroPoliza}. ` +
                        `Error: ${obtenerMensajeError(error)}`
                    );
                }
            }
    
    
            /**
             * CASO 3
             *
             * Si estamos directamente sobre el endoso 0
             * o RUS no permitió recuperar el detalle,
             * hacemos fallback al importe disponible.
             */
            if (premioPoliza === undefined) {
    
                premioPoliza =
                    Number(actual.premio ?? 0);
            }
    
    
            propuestasConsolidadas.push({
                ...actual,
                premioPoliza
            });
        }
    
    
        return propuestasConsolidadas;
    }


}