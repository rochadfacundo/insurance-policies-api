import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";
import {    MercantilPoliza,    MercantilPolizasResponse} from "../models/mercantilModelPolizas";

import { MercantilPolizasManager }from "../models/mercantilPolizasManager";
import { MercantilBienesPolizaManager } from "./mercantilBienesPolizaManager";
import { obtenerBienesPoliza } from "./mercantilBienesService";
import { obtenerDetallePoliza } from "./mercantilDetallePolizaService";

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

    constructor(
        pageSize: number = 100
    ) {
        this.pageSize = pageSize;
    }

    /**
     * Obtiene los bienes de una póliza específica.
     * Si total o cantidad es mayor a 1, se considera flota.
     * Construye un MercantilBienesPolizaManager con la respuesta.
     * No contiene lógica de negocio, solo delega la consulta a mercantilBienesService.
     * La lógica de negocio sobre los bienes vive en MercantilBienesPolizaManager.
     * @param poliza Número de póliza.
     * @param endoso Número de endoso.
     * @return Un MercantilBienesPolizaManager con los bienes de la póliza.
     * @throws Error si la consulta falla.
     * @see MercantilBienesPolizaManager
     * @see mercantilBienesService.obtenerBienesPoliza
     * */
    async obtenerBienesPoliza(poliza: number,endoso: number): Promise<MercantilBienesPolizaManager> {
    
        const bienes =  await obtenerBienesPoliza(poliza, endoso);
    
        return new MercantilBienesPolizaManager(bienes);
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