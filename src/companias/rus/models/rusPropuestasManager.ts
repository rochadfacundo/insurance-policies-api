/**
 * Gestiona una colección de propuestas obtenidas desde la API de RUS.
 *
 * Responsabilidades:
 * - Mantener la respuesta completa de la API.
 * - Mantener la lista de propuestas del productor.
 * - Mantener metadatos importantes como:
 *      - código de productor
 *      - cantidad total de propuestas
 * - Buscar propuestas por distintos criterios.
 * - Obtener propuestas vigentes, vencidas y próximas a vencer.
 * - Obtener renovaciones y propuestas nuevas.
 * - Obtener estadísticas y resúmenes de cartera.
 * - Ordenar propuestas por distintos criterios.
 *
 * Esta clase NO realiza llamadas HTTP.
 * La obtención de datos corresponde al RusPropuestasService.
 */

import { parseFecha } from "../../../utils/utils";
import { RusPropuesta, RusPropuestasResponse} from "./rusPropuestasInterfaces";

export class RusPropuestasManager {

    /**
     * Atributos privados de la clase, que almacenan información relevante de la cartera de propuestas.
     */
    private readonly productor: number;
    private readonly total: number;
    private readonly propuestas: RusPropuesta[];

    private readonly SECCION_AUTOMOTOR=4;

    /**
     * Constructor de la clase RusPropuestasManager. 
     * Primero valida la respuesta de la API de RUS, y luego inicializa los atributos privados 
     * con la información relevante de la cartera de propuestas.
     * @param response La respuesta de la API de RUS que contiene las propuestas y metadatos. 
     * @see RusPropuestasResponse para la estructura de la respuesta de la API de RUS.
     */
    constructor(private readonly response: RusPropuestasResponse) {
    
        this.validarResponse(this.response);
    
        this.propuestas = this.response.results;
        this.total = this.response.paging.total;
        this.productor = this.response.results[0]?.productor ?? 0;
    }

    /**
     * Valida la respuesta de la API de RUS. 
     * @param response La respuesta de la API de RUS a validar. 
     * @see RusPropuestasResponse para la estructura de la respuesta de la API de RUS.
     */
    private validarResponse(response: RusPropuestasResponse): void {
    
        if (!response) {
          throw new Error("RusPropuestasResponse es requerido.");
        }
    
        if (!Array.isArray(response.results)) {
            throw new Error("response.results debe ser un array.");
        }
    
        if (!response.paging || typeof response.paging.total !== "number") {
            throw new Error("paging.total inválido.");
        }
    
        if (response.paging.total < 0) {
            throw new Error("paging.total no puede ser negativo.");
        }
    }

    /**
     * Obtiene propuestas que vencen dentro de X días. 
     * @param dias el número de días para filtrar las propuestas próximas a vencer. Debe ser un número mayor o igual a 0.   
     * @returns un array de propuestas que vencen dentro de los días especificados. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getProximasARenovar(dias: number): RusPropuesta[] {
    
        if (!Number.isFinite(dias) || dias < 0) {
            throw new Error("Los días deben ser un número válido mayor o igual a 0.");
        }
    
        return this.getQueVencenEn(dias);
    }

    /**
     * Obtiene propuestas de flotas. 
     * @returns un array de propuestas que son flotas. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getFlotas(): RusPropuesta[] {

        return this.propuestas.filter(p => p.esFlota);
    }

    /**
     * Determina si una propuesta es de flota.
     * @param propuesta La propuesta a evaluar.
     * @returns true si la propuesta es de flota, false en caso contrario.
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    esFlota(propuesta:RusPropuesta) : boolean {
        
        return propuesta.numeroSeccion === this.SECCION_AUTOMOTOR && propuesta.esFlota;
    }

    /**
     * Obtiene propuestas con premio positivo. 
     * @returns un array de propuestas cuyo premio es mayor a 0. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getConPremioPositivo(): RusPropuesta[] {

        return this.propuestas.filter(p => p.premio > 0);
    }

    /**
     * Obtiene propuestas con premio mayor o igual a un valor mínimo. 
     * @param premioMinimo el valor mínimo de premio para filtrar las propuestas. Debe ser un número mayor o igual a 0.   
     * @returns un array de propuestas cuyo premio es mayor o igual al valor especificado. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getConPremioMayorA(premioMinimo: number): RusPropuesta[] {
    
        if (premioMinimo < 0) {
            throw new Error("El premio mínimo no puede ser negativo.");
        }
    
        return this.propuestas.filter(p => p.premio >= premioMinimo);
    }

    /**
     * Obtiene propuestas que son flotas o tienen premio mayor o igual a un valor mínimo. 
     * @param premioMinimo el valor mínimo de premio para filtrar las propuestas. Debe ser un número mayor o igual a 0. 
     * @returns un array de propuestas que son flotas o cuyo premio es mayor o igual al valor especificado. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    private getRiesgosRelevantes(premioMinimo: number = 5000000): RusPropuesta[] {

        return this.propuestas.filter(p => p.esFlota || p.premio >= premioMinimo);
    }

    /**
     * Devuelve un resumen comercial de la cartera. 
     * @returns un objeto con la cantidad de flotas, riesgos mayores y riesgos relevantes. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getResumenComercial() {

        return {

            flotas: this.getFlotas().length,

            riesgosMayores: this.getConPremioMayorA(5000000).length,

            riesgosRelevantes: this.getRiesgosRelevantes().length
        };
    }

    /**
     * Devuelve un resumen de las renovaciones próximas a vencer. 
     * @param dias el número de días para filtrar las propuestas próximas a vencer. Debe ser un número mayor o igual a 0. 
     * @returns un array de objetos con la información resumida de las propuestas próximas a vencer. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getResumenRenovaciones(dias: number) {

        if (!Number.isFinite(dias) || dias < 0) {
            throw new Error("Los días deben ser un número válido mayor o igual a 0.");
        }

        return this.getProximasARenovar(dias).map( propuesta => ({

                numeroPoliza: propuesta.numeroPoliza,
                nombre: propuesta.nombrePersona.trim(),
                documento: propuesta.docPersona,
                productor: propuesta.productor,
                cobertura: propuesta.cobertura,
                premio: propuesta.premio,
                vence: propuesta.finVigencia
            })
        );
    }

    /**
     * Calcula la cantidad de días que faltan para el vencimiento de una propuesta según su número de póliza. 
     * @param numeroPoliza el número de póliza de la propuesta a evaluar. Debe ser un número mayor a 0. 
     * @returns la cantidad de días que faltan para el vencimiento de la propuesta. Si la propuesta no se encuentra, retorna null. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getDiasParaVencimiento(numeroPoliza:number): number | null {

        if (numeroPoliza <= 0) {
            throw new Error("Número de póliza inválido.");
        }
    
        const propuesta = this.getPropuesta(numeroPoliza);
    
        if (!propuesta) {
            return null;
        }
    
        const hoy = new Date();
    
        const vencimiento = parseFecha(propuesta.finVigencia);
    
        const diferencia = vencimiento.getTime() - hoy.getTime();

        return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    }

    /**
     * Devuelve la respuesta completa de la API de RUS. 
     * @returns la respuesta completa de la API de RUS que contiene las propuestas y metadatos. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getResponse(): RusPropuestasResponse 
    {
        return this.response;
    }

    /**
     * Devuelve la lista de propuestas obtenidas de la API de RUS. 
     * @returns un array de propuestas obtenidas de la API de RUS. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuestas(): RusPropuesta[] {
        return this.propuestas;
    }

    /**
     * Devuelve el código de productor de la cartera. 
     * @returns el código de productor de la cartera. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getProductor(): number {
        return this.productor;
    }

    /**
     *  Devuelve la cantidad total de propuestas obtenidas de la API de RUS. 
     * @returns la cantidad total de propuestas obtenidas de la API de RUS. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getCantidad(): number {
        return this.total;
    }

    /**
     * Devuelve la información de paginación de la respuesta de la API de RUS. 
     * @returns un objeto con la información de paginación de la respuesta de la API de RUS. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPaging() {
        return this.response.paging;
    }

    /**
     * Busca una propuesta por número de póliza.   
     * @param numeroPoliza el número de póliza de la propuesta a buscar. Debe ser un número mayor a 0. 
     * @returns la propuesta encontrada o undefined si no se encuentra ninguna propuesta con el número de póliza especificado. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuesta(numeroPoliza: number): RusPropuesta | undefined {
        if (!Number.isFinite(numeroPoliza) || numeroPoliza <= 0 ) 
        {
            throw new Error("Número de póliza inválido.");
        }

        return this.propuestas.find(p => p.numeroPoliza === numeroPoliza);
    }

    /**
     * Busca propuestas por número de documento. 
     * @param documento el número de documento de la persona titular de la propuesta. Debe ser un número mayor a 0. 
     * @returns un array de propuestas cuyo titular tiene el número de documento especificado. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuestasPorDocumento(documento: number): RusPropuesta[] {

        if (documento <= 0) {
            throw new Error("Documento inválido.");
        }

        return this.propuestas.filter(p => p.docPersona === documento);
    }

    /**
     * Busca propuestas por nombre de persona. 
     * @param nombre el nombre de la persona titular de la propuesta. Debe ser un string no vacío. 
     * @returns un array de propuestas cuyo titular tiene un nombre que contiene el string especificado (case insensitive). 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuestasPorNombre(nombre: string): RusPropuesta[] {

        if (!nombre?.trim()) {
            throw new Error("Debe indicar un nombre.");
        }

        const filtro = nombre.trim().toUpperCase();

        return this.propuestas.filter(
            p =>
                p.nombrePersona
                    .trim()
                    .toUpperCase()
                    .includes(filtro)
        );
    }

    /**
     * Busca propuestas por cobertura. 
     * @param cobertura el nombre de la cobertura de la propuesta. Debe ser un string no vacío. 
     * @returns un array de propuestas cuya cobertura contiene el string especificado (case insensitive). 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuestasPorCobertura(cobertura: string): RusPropuesta[] {

        if (!cobertura?.trim()) {
            throw new Error("Debe indicar una cobertura.");
        }

        const filtro = cobertura.trim().toUpperCase();

        return this.propuestas.filter(
            p =>
                p.cobertura
                    .trim()
                    .toUpperCase()
                    .includes(filtro)
        );
    }

    /**
     * Busca propuestas por número de sección. 
     * @param numeroSeccion el número de sección de la propuesta. Debe ser un número mayor a 0. 
     * @returns un array de propuestas cuyo número de sección es igual al especificado. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPropuestasPorSeccion(numeroSeccion: number): RusPropuesta[] {

        if (numeroSeccion <= 0) {
            throw new Error("Número de sección inválido.");
        }

        return this.propuestas.filter(p => p.numeroSeccion === numeroSeccion);
    }
    
    /**
     * Obtiene propuestas vigentes. 
     * @returns Retorna un array de propuestas cuyo estado de vigencia es "VIGENTE". 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getVigentes(): RusPropuesta[] {

        return this.propuestas.filter(
            p =>
                p.vigenciaEstado
                    .trim()
                    .toUpperCase() === "VIGENTE"
        );
    }

    /**
     * Obtiene propuestas vencidas. 
     * @returns Retorna un array de propuestas cuya fecha de fin de vigencia es menor a la fecha actual. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getVencidas(): RusPropuesta[] {

        const hoy = new Date();

        return this.propuestas.filter( p => parseFecha(p.finVigencia) < hoy);
    }

    /**
     * Obtiene propuestas que vencen dentro de X días. 
     * @param dias el número de días para filtrar las propuestas próximas a vencer. Debe ser un número mayor o igual a 0.   
     * @returns un array de propuestas que vencen dentro de los días especificados. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getQueVencenEn(dias: number): RusPropuesta[] {

        if (!Number.isFinite(dias) || dias < 0) {
            throw new Error("Los días deben ser un número válido mayor o igual a 0.");
        }

        const hoy = new Date();

        const limite = new Date();

        limite.setDate(limite.getDate() + dias);

        return this.propuestas.filter(
            p => {
        
                const vencimiento = parseFecha(p.finVigencia);
        
                return (vencimiento >= hoy && vencimiento <= limite);
            }
        );
    }

    /**
     * Obtiene propuestas de renovación. 
     * @returns un array de propuestas cuya propiedad "renovacion" es mayor a 0. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getRenovaciones(): RusPropuesta[] {

        return this.propuestas.filter(
            p => p.renovacion > 0
        );
    }

    /**
     * Obtiene propuestas nuevas. 
     * @returns un array de propuestas cuya propiedad "renovacion" es igual a 0. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getNuevas(): RusPropuesta[] {

        return this.propuestas.filter(
            p => p.renovacion === 0
        );
    }

    /**
     * Calcula el premio total de la cartera. 
     * @returns el premio total de la cartera, sumando el premio de todas las propuestas. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getPremioTotal(): number {

        return this.propuestas.reduce(
            (total, propuesta) =>
                total + propuesta.premio,
            0
        );
    }

    /**
     * Calcula la cuota total de la cartera. 
     * @returns la cuota total de la cartera, sumando la cuota de todas las propuestas. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getCuotaTotal(): number {

        return this.propuestas.reduce(
            (total, propuesta) =>
                total + propuesta.cuota,
            0
        );
    }

    /**
     * Calcula el premio promedio de la cartera. 
     * @returns el premio promedio de la cartera, dividiendo el premio total entre la cantidad de propuestas. 
     * @see RusPropuesta para la estructura de cada propuesta.*  Si no 
     * hay propuestas, retorna 0. 
     */
    getPremioPromedio(): number {

        if (this.propuestas.length === 0)
            return 0;

        return (
            this.getPremioTotal() /
            this.propuestas.length
        );
    }

    /**
     * Calcula la cantidad de propuestas por número de sección. 
     * @returns un objeto donde las claves son los números de sección y los valores son la cantidad de propuestas en cada sección. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    getCantidadPorSeccion(): Record<number, number> {

        return this.propuestas.reduce(
            (acc, propuesta) => {

                acc[propuesta.numeroSeccion] =
                    (acc[propuesta.numeroSeccion] || 0)
                    + 1;

                return acc;

            },
            {} as Record<number, number>
        );
    }

    /**
     * Ordena las propuestas por fecha de vencimiento, de la más próxima a la más lejana. 
     * @returns un array de propuestas ordenadas por fecha de vencimiento. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    ordenarPorVencimiento(): RusPropuesta[] {

        return [...this.propuestas]
            .sort(
                (a, b) =>
                    parseFecha(a.finVigencia).getTime()
                    -
                    parseFecha(b.finVigencia).getTime()
            );
    }

    /**
     * Ordena las propuestas por premio, de mayor a menor. 
     * @returns un array de propuestas ordenadas por premio. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    ordenarPorPremio(): RusPropuesta[] {

        return [...this.propuestas]
            .sort(
                (a, b) =>
                    b.premio - a.premio
            );
    }

    /**
     * Ordena las propuestas por nombre de persona, de la A a la Z. 
     * @returns un array de propuestas ordenadas por nombre de persona. 
     * @see RusPropuesta para la estructura de cada propuesta.    
    */
    ordenarPorNombre(): RusPropuesta[] {

        return [...this.propuestas]
            .sort(
                (a, b) =>
                    a.nombrePersona.localeCompare(
                        b.nombrePersona
                    )
            );
    }

    /**
     * Devuelve un resumen de la cartera de propuestas. 
     * @returns un objeto con el productor, total de propuestas, cantidad de vigentes, vencidas, renovaciones,
     *  nuevas, premio total, cuota total y riesgos relevantes. 
     * @see RusPropuesta para la estructura de cada propuesta.*  
     */
    getResumen() {

        return {
            productor: this.productor,
            total: this.total,
            vigentes: this.getVigentes().length,
            vencidas: this.getVencidas().length,
            renovaciones: this.getRenovaciones().length,
            nuevas: this.getNuevas().length,
            premioTotal: this.getPremioTotal(),
            cuotaTotal: this.getCuotaTotal(),
            riesgosRelevantes: this.getRiesgosRelevantes().length,
        };
    }
}