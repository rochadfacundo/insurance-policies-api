// mercantil/services/mercantilPolizasManager.ts

import {
    MercantilPoliza,
    MercantilPolizasResponse
} from "./mercantilModelPolizas";
/*
    * Clase para gestionar y analizar las pólizas de Mercantil.
    * Proporciona métodos para filtrar, ordenar y obtener estadísticas.
    * Recibe un MercantilPolizasResponse completo y expone métodos de negocio.
    * No realiza consultas ni llamadas adicionales, solo maneja la lógica de negocio sobre las pólizas.
    * @see MercantilPoliza
    * @see MercantilPolizasResponse    
*/
export class MercantilPolizasManager {

    private nombreProductor:string;
    private codigoProductor:number;

    constructor(private readonly response: MercantilPolizasResponse) 
    {
    const primeraPoliza = response.polizas[0];

    this.nombreProductor = primeraPoliza?.nombreProductor ?? "Desconocido";

    this.codigoProductor = primeraPoliza?.productor ?? 0;
    }

     /**
     * Devuelve el nombre del productor. Si no se encuentra, devuelve "Desconocido".
     */
    getNombreProductor(): string {
        return this.nombreProductor;
    }

    /**
    * Devuelve el código del productor. Si no se encuentra, devuelve 0.
    */
    getCodigoProductor(): number {
        return this.codigoProductor;
    }


    /**
     * Devuelve la respuesta completa.
     */
    getResponse(): MercantilPolizasResponse {
        return this.response;
    }

    /**
     * Devuelve todas las pólizas.
     */
    getPolizas(): MercantilPoliza[] {
        return this.response.polizas;
    }

    /**
     * Cantidad total de pólizas descargadas.
     */
    getCantidad(): number {
        return this.response.polizas.length;
    }

    /**
     * Busca una póliza por número.
     */
    getPoliza(numeroPoliza: number): MercantilPoliza | undefined {

        return this.response.polizas.find(p => p.poliza === numeroPoliza);
    }

    /**
     * Busca pólizas por documento.
     */
    getPolizasPorDocumento(documento: number): MercantilPoliza[] {

        return this.response.polizas.filter(
            p => p.documento === documento
        );
    }

    /**
     * Busca pólizas por código de asegurado.
     */
    getPolizasPorCodigoAsegurado(codigoAsegurado: number): MercantilPoliza[] {
        return this.response.polizas.filter( p => p.codigoAsegurado === codigoAsegurado);
    }

    /**
     * Busca pólizas por número de cliente.
     */
    getPolizasPorNumeroCliente(numeroCliente: number): MercantilPoliza[] {
        return this.response.polizas.filter(p => p.numeroCliente === numeroCliente);
    }

    /**
     * Busca por nombre del asegurado.
     */
    getPolizasPorNombre(nombre: string): MercantilPoliza[] {

        const filtro = nombre.toUpperCase();

        return this.response.polizas.filter(p => p.nombreAsegurado.toUpperCase().includes(filtro));
    }

    /**
     * Busca por productor.
     */
    getPolizasPorProductor(productor: number): MercantilPoliza[] {
        return this.response.polizas.filter(p => p.productor === productor);
    }

    /**
     * Obtiene todas las pólizas renovadas.
     */
    getPolizasRenovadas(): MercantilPoliza[] {
        return this.response.polizas.filter(p=> p.polizaAnterior > 0);
    }

    /**
     * Obtiene pólizas nuevas.
     */
    getPolizasNuevas(): MercantilPoliza[] {
        return this.response.polizas.filter(p => p.polizaAnterior === 0);
    }

    /**
     * Obtiene una renovación específica.
     */
    getRenovacionDePoliza(numeroPolizaAnterior: number): MercantilPoliza | undefined {

        return this.response.polizas.find(p => p.polizaAnterior === numeroPolizaAnterior);
    }

    /**
     * Obtiene pólizas por sección.
     */
    getPolizasPorSeccion(seccion: number): MercantilPoliza[] {
        return this.response.polizas.filter(p => p.seccion === seccion);
    }

    /**
    * Determina si una póliza es una flota de automotores.
    */
    esFlota(poliza: MercantilPoliza): boolean {
        return (poliza.seccion === 5 && poliza.bienAsegurado.toUpperCase().includes("FLOTA"));
    }

    /**
     * Devuelve todas las flotas detectadas.
     */
    getFlotas(): MercantilPoliza[] {
        const SECCION_AUTOMOTOR = 5;
        return this.response.polizas.filter(poliza => 
            poliza.seccion === SECCION_AUTOMOTOR && poliza.bienAsegurado.toUpperCase().includes("FLOTA"));
    }

    /**
     * Autos.
     */
    getPolizasAutos(): MercantilPoliza[] {
        return this.getPolizasPorSeccion(5);
    }

    /**
     * Accidentes personales.
     */
    getPolizasAccidentesPersonales(): MercantilPoliza[] {

        return this.getPolizasPorSeccion(6);
    }

    /**
     * Hogar.
     */
    getPolizasHogar(): MercantilPoliza[] {

        return this.getPolizasPorSeccion(16);
    }

    /**
     * Obtiene pólizas activas para una fecha.
     */
    getPolizasActivasEnFecha(fecha: Date): MercantilPoliza[] {

        return this.response.polizas.filter(p => {

                const desde = new Date(p.desde);
                const hasta = new Date(p.hasta);

                return (fecha >= desde && fecha <= hasta);
            }
        );
    }

    /**
     * Obtiene pólizas vencidas.
     */
    getPolizasVencidas(): MercantilPoliza[] {

        const hoy = new Date();

        return this.response.polizas.filter(p => new Date(p.hasta) < hoy);
    }

    /**
     * Obtiene pólizas vigentes.
     */
    getPolizasVigentes(): MercantilPoliza[] {

        const hoy = new Date();

        return this.response.polizas.filter(p =>new Date(p.hasta) >= hoy);
    }

    /**
     * Obtiene pólizas que vencen antes de una fecha.
     */
    getPolizasQueVencenAntes(fecha: Date): MercantilPoliza[] {

        return this.response.polizas.filter(p => new Date(p.hasta) <= fecha);
    }

    /**
     * Obtiene pólizas que vencen dentro de X días.
     */
    getPolizasQueVencenEn(dias: number): MercantilPoliza[] {

        const hoy = new Date();

        const limite = new Date();

        limite.setDate(hoy.getDate() + dias);

        return this.response.polizas.filter(p => {

                const vencimiento =  new Date(p.hasta);

                return (vencimiento >= hoy && vencimiento <= limite);
            }
        );
    }

    /**
     * Agrupa por sección.
     */
    getCantidadPorSeccion(): Record<number, number> {

        return this.response.polizas.reduce((acc, poliza) => {

                acc[poliza.seccion] = (acc[poliza.seccion] || 0) + 1;

                return acc;
            },{} as Record<number, number>);
    }

    /**
     * Obtiene lista única de productores.
     */
    getProductores(): number[] {
        return [...new Set(this.response.polizas.map(p => p.productor))];
    }

    /**
     * Obtiene lista única de asegurados.
     */
    getAsegurados(): string[] {
        return [...new Set(this.response.polizas.map(p => p.nombreAsegurado))];
    }

    /**
     * Ordena por fecha de vencimiento.
     */
    ordenarPorVencimiento(): MercantilPoliza[] {
        return [...this.response.polizas].sort((a, b) => new Date(a.hasta).getTime() - new Date(b.hasta).getTime());
    }

    /**
     * Ordena por nombre.
     */
    ordenarPorNombre(): MercantilPoliza[] {
        return [...this.response.polizas].sort((a, b) => a.nombreAsegurado.localeCompare(b.nombreAsegurado));
    }

        
    /**
    * Devuelve un resumen con información clave.
    */
    toString() {

        return {
            productor: this.codigoProductor,
            nombreProductor: this.nombreProductor,
            total: this.getCantidad(),
            autos: this.getPolizasAutos().length,
            hogar: this.getPolizasHogar().length,
            accidentes: this.getPolizasAccidentesPersonales().length,
            renovadas: this.getPolizasRenovadas().length,
            nuevas: this.getPolizasNuevas().length
        };
    }
}