import { MercantilBienesPolizaManager } from "../models/mercantilBienesPolizaManager";
import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";
import {    MercantilPoliza,    MercantilPolizasResponse} from "../models/mercantilModelPolizas";

import { MercantilPolizasManager }from "../models/mercantilPolizasManager";
import { obtenerBienesPoliza } from "./mercantilBienesService";
import { obtenerDetallePoliza } from "./mercantilDetallePolizaService";
import axios from "axios";
import { obtenerPolizasVigentes } from "./mercantilPolizasService";

/**
 * Servicio encargado de reconstruir
 * la cartera completa de Mercantil.
 *
 * Responsabilidades:
 * - Consultar todas las páginas.
 * - Acumular pólizas.
 * - Eliminar duplicados.
 * - Construir un MercantilPolizasManager.
 *
 * NO contiene lógica de negocio.
 * La lógica vive en MercantilPolizasManager.
 */
export class MercantilCarteraService {

    private readonly pageSize: number;

    constructor(pageSize: number = 100) {
        this.pageSize = pageSize;
    }

    /**
 * Obtiene los bienes de una póliza específica.
 *
 * Primero consulta utilizando el endoso informado por la cartera.
 * Si Mercantil devuelve el error SQL0305 y el endoso es distinto de 0,
 * reintenta la consulta utilizando el endoso 0.
 *
 * @param poliza Número de póliza.
 * @param endoso Número de endoso informado por la cartera.
 * @return Un MercantilBienesPolizaManager con los bienes de la póliza.
 * @throws Error si la consulta original falla por un error diferente a SQL0305
 * o si también falla el reintento con endoso 0.
 */
async obtenerBienesPoliza(poliza: number, endoso: number): Promise<MercantilBienesPolizaManager> {

    try {

        const bienes = await obtenerBienesPoliza(poliza,endoso);

        return new MercantilBienesPolizaManager(bienes);

    } catch (error) {

        const puedeReintentar = endoso !== 0 && this.esErrorSql0305(error);

        if (!puedeReintentar) {
            throw error;
        }

        console.warn(`Mercantil devolvió SQL0305 para la póliza ${poliza}, ` + `endoso ${endoso}. Reintentando bienes con endoso 0...`);

        const bienesEndosoCero = await obtenerBienesPoliza(poliza,0);

        console.warn(`Fallback exitoso para la póliza ${poliza}: ` +`se utilizaron los bienes del endoso 0 en lugar del endoso ${endoso}.`);

        return new MercantilBienesPolizaManager(bienesEndosoCero);
    }
}


/**
 * Verifica si Mercantil respondió con el error interno SQL0305.
 */
private esErrorSql0305(error: unknown): boolean {

    if (!axios.isAxiosError(error)) {
        return false;
    }

    const data = error.response?.data as {
        errores?: Array<{
            id?: string;
            texto?: string;
        }>;
    } | undefined;

    return data?.errores?.some(item => item.id === "SQL0305") ?? false;
}



    async obtenerDetallePoliza(poliza: number, endoso: number): Promise<MercantilDetallePolizaManager> {
    
        const detalle = await obtenerDetallePoliza(poliza,endoso);
    
        return new MercantilDetallePolizaManager(detalle);
    }




    /**
     * Obtiene la cartera completa de un productor.
     * Consulta todas las páginas de pólizas vigentes del productor.
     * Acumula todas las pólizas en un array.
     * Elimina duplicados por número de póliza.
     * Construye un MercantilPolizasManager con la respuesta completa.
     * No contiene lógica de negocio, solo delega la consulta a mercantilPolizasService.
     * La lógica de negocio sobre las pólizas vive en MercantilPolizasManager.
     * @see MercantilPolizasManager
     * @see mercantilPolizasService.obtenerPolizasVigentes para obtener una página de pólizas vigentes.
     * @throws Error si la consulta falla por cualquier motivo.
     * @param productor Número de productor.
     * @return Un MercantilPolizasManager con la cartera completa del productor.
     */
    async obtenerCarteraCompleta(productor: number): Promise<MercantilPolizasManager> {

        let offset = 0;

        let total = 0;

        const polizas: MercantilPoliza[] = [];

        do {

            console.log(`Consultando offset ${offset}...`);

            const response = await obtenerPolizasVigentes(productor, this.pageSize, offset);

            total = response.total;

            polizas.push(...response.polizas);

            offset += this.pageSize;

        } while (offset < total);

        const polizasSinDuplicados = this.eliminarDuplicados(polizas);

        const responseCompleta: MercantilPolizasResponse = {

            productor,
            offset: 0,
            limit: polizasSinDuplicados.length,
            total: polizasSinDuplicados.length,
            polizas: polizasSinDuplicados
        };

        return new MercantilPolizasManager(responseCompleta);
    }

    /**
     * Elimina pólizas duplicadas.
     */
    private eliminarDuplicados(polizas: MercantilPoliza[]): MercantilPoliza[] {

        const map = new Map<number,MercantilPoliza>();

        for (const poliza of polizas) {
            map.set(poliza.poliza,poliza);
        }

        return Array.from(map.values());
    }
}