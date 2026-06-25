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

    private readonly productor: number;
    private readonly total: number;
    private readonly propuestas: RusPropuesta[];

    private readonly SECCION_AUTOMOTOR=4;

    constructor(private readonly response: RusPropuestasResponse) {
    
        this.validarResponse(this.response);
    
        this.propuestas = this.response.results;
        this.total = this.response.paging.total;
        this.productor = this.response.results[0]?.productor ?? 0;
    }

    /*
        * Valida la estructura de la respuesta.
        * Lanza errores descriptivos si encuentra problemas.
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
     * Obtiene propuestas próximas a renovar.
     *
     * Internamente utiliza la fecha de fin de vigencia.
     */
    getProximasARenovar(dias: number): RusPropuesta[] {
    
        if (!Number.isFinite(dias) || dias < 0) {
            throw new Error("Los días deben ser un número válido mayor o igual a 0.");
        }
    
        return this.getQueVencenEn(dias);
    }

    /**
     * Obtiene únicamente propuestas de flotas.
    */
    getFlotas(): RusPropuesta[] {

        return this.propuestas.filter(p => p.esFlota);
    }

    /**
     * Obtiene true si es flota
    */
    esFlota(propuesta:RusPropuesta) : boolean {
        
        return propuesta.numeroSeccion === this.SECCION_AUTOMOTOR && propuesta.esFlota;
    }

    /**
     * Obtiene propuestas con premio positivo.
     */
    getConPremioPositivo(): RusPropuesta[] {

        return this.propuestas.filter(p => p.premio > 0);
    }

    /**
     * Obtiene propuestas cuya prima supera el monto indicado.
     */
    getConPremioMayorA(premioMinimo: number): RusPropuesta[] {
    
        if (premioMinimo < 0) {
            throw new Error("El premio mínimo no puede ser negativo.");
        }
    
        return this.propuestas.filter(p => p.premio >= premioMinimo);
    }

    /**
     * Obtiene riesgos relevantes para gestión comercial.
     *
     * - Flotas
     * - Primas superiores al importe indicado
     */
    private getRiesgosRelevantes(premioMinimo: number = 5000000): RusPropuesta[] {

        return this.propuestas.filter(p => p.esFlota || p.premio >= premioMinimo);
    }

    /**
     * Resumen comercial de la cartera.
     */
    getResumenComercial() {

        return {

            flotas: this.getFlotas().length,

            riesgosMayores: this.getConPremioMayorA(5000000).length,

            riesgosRelevantes: this.getRiesgosRelevantes().length
        };
    }

    /**
    * Devuelve un resumen simplificado
    * de las pólizas próximas a renovar.
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
     * * Obtiene la cantidad de días para el vencimiento de una propuesta.
     * * Devuelve null si no se encuentra la propuesta.
     * * Calcula la diferencia entre la fecha de fin de vigencia y la fecha actual.
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
     * Devuelve la respuesta completa.
     */
    getResponse(): RusPropuestasResponse 
    {
        return this.response;
    }

    /**
     * Devuelve todas las propuestas.
     */
    getPropuestas(): RusPropuesta[] {
        return this.propuestas;
    }

    /**
     * Devuelve el código del productor.
     */
    getProductor(): number {
        return this.productor;
    }

    /**
     * Devuelve la cantidad total.
     */
    getCantidad(): number {
        return this.total;
    }

    /**
     * Devuelve la información de paginado.
     */
    getPaging() {
        return this.response.paging;
    }

    /**
     * Busca una propuesta por número de póliza.
     */
    getPropuesta(numeroPoliza: number): RusPropuesta | undefined {
        if (!Number.isFinite(numeroPoliza) || numeroPoliza <= 0 ) 
        {
            throw new Error("Número de póliza inválido.");
        }

        return this.propuestas.find(p => p.numeroPoliza === numeroPoliza);
    }

    /**
     * Busca propuestas por documento.
     */
    getPropuestasPorDocumento(documento: number): RusPropuesta[] {

        if (documento <= 0) {
            throw new Error("Documento inválido.");
        }

        return this.propuestas.filter(p => p.docPersona === documento);
    }

    /**
     * Busca propuestas por nombre.
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
     * Busca propuestas por sección.
     */
    getPropuestasPorSeccion(numeroSeccion: number): RusPropuesta[] {

        if (numeroSeccion <= 0) {
            throw new Error("Número de sección inválido.");
        }

        return this.propuestas.filter(p => p.numeroSeccion === numeroSeccion);
    }

    /**
     * Obtiene propuestas vigentes.
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
     */
    getVencidas(): RusPropuesta[] {

        const hoy = new Date();

        return this.propuestas.filter( p => parseFecha(p.finVigencia) < hoy);
    }

    /**
     * Obtiene propuestas que vencen dentro de X días.
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
     * Obtiene renovaciones.
     */
    getRenovaciones(): RusPropuesta[] {

        return this.propuestas.filter(
            p => p.renovacion > 0
        );
    }

    /**
     * Obtiene propuestas nuevas.
     */
    getNuevas(): RusPropuesta[] {

        return this.propuestas.filter(
            p => p.renovacion === 0
        );
    }

    /**
     * Premio total de la cartera.
     */
    getPremioTotal(): number {

        return this.propuestas.reduce(
            (total, propuesta) =>
                total + propuesta.premio,
            0
        );
    }

    /**
     * Cuota total de la cartera.
     */
    getCuotaTotal(): number {

        return this.propuestas.reduce(
            (total, propuesta) =>
                total + propuesta.cuota,
            0
        );
    }

    /**
     * Premio promedio.
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
     * Agrupa por sección.
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
     * Ordena por vencimiento.
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
     * Ordena por premio.
     */
    ordenarPorPremio(): RusPropuesta[] {

        return [...this.propuestas]
            .sort(
                (a, b) =>
                    b.premio - a.premio
            );
    }

    /**
     * Ordena por nombre.
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
     * Devuelve un resumen de la cartera.
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