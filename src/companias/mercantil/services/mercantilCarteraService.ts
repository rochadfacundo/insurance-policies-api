import { MercantilBienesPolizaManager } from "../models/mercantilBienesPolizaManager";
import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";
import {    MercantilPoliza,    MercantilPolizasResponse} from "../models/mercantilModelPolizas";

import { MercantilPolizasManager }from "../models/mercantilPolizasManager";
import { obtenerBienesPoliza } from "./mercantilBienesService";
import { obtenerDetallePoliza } from "./mercantilDetallePolizaService";
import axios from "axios";
import { obtenerPolizasVigentes } from "./mercantilPolizasService";
import { esErrorSql0305 } from "../../../utils/utils";
import { PeriodicidadFacturacion } from "../../../models/periodicidadFacturacion";

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

    // Número de pólizas por página a consultar. Por defecto es 100.
    private readonly pageSize: number;

    /**
     * Crea una instancia de MercantilCarteraService. 
     * @param pageSize Número de pólizas por página a consultar. Por defecto es 100. 
     */
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

            //Verifica si endoso no es 0 y si Mercantil respondió con el error interno SQL0305.
            const puedeReintentar =  endoso !== 0 && esErrorSql0305(error);

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
     * Obtiene el detalle de una póliza específica. 
     * @param poliza poliza Número de póliza. 
     * @param endoso endoso Número de endoso. 
     * @returns Un MercantilDetallePolizaManager con el detalle de la póliza.
     * @see MercantilDetallePolizaManager 
     */
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
     * Elimina pólizas duplicadas por número de póliza, conservando la última ocurrencia. 
     * @param polizas el arreglo de pólizas a filtrar. 
     * @returns un arreglo de pólizas sin duplicados, conservando la última ocurrencia por número de póliza. 
     * @see MercantilPolizasManager para la lógica de negocio sobre las pólizas.
     */
    private eliminarDuplicados(polizas: MercantilPoliza[]): MercantilPoliza[] {

        const map = new Map<number,MercantilPoliza>();

        for (const poliza of polizas) {
            map.set(poliza.poliza,poliza);
        }

        return Array.from(map.values());
    }

    /**
     * Determina la periodicidad de facturación de una póliza
     * analizando sus movimientos históricos.
     *
     * Para confirmar periodicidad mensual se requieren
     * dos períodos mensuales consecutivos.
     *
     * No modifica información ni escribe en Firestore.
     */
    async obtenerPeriodicidadFacturacion(
        poliza: number,
        endosoActual: number
    ): Promise<PeriodicidadFacturacion> {

        const facturaciones: MercantilDetallePolizaManager[] = [];

        let consultasIncompletas = false;

        for (let endoso = endosoActual; endoso >= 0; endoso--) {

            try {
                const detalle = await this.obtenerDetallePoliza(
                    poliza,
                    endoso
                );

                const tipo = detalle.getTipo()?.trim().toUpperCase();

                if (tipo === "FACTURACION") {
                    facturaciones.push(detalle);
                }

                // Solo necesitamos las dos últimas facturaciones.
                if (facturaciones.length === 2) {
                    break;
                }

            } catch (error) {
                consultasIncompletas = true;

                console.warn(
                    `No se pudo consultar el endoso ${endoso} ` +
                    `de la póliza ${poliza} al analizar periodicidad.`
                );
            }
        }

        if (consultasIncompletas) {
            return PeriodicidadFacturacion.INDETERMINADA;
        }
        
        const ultima = facturaciones[0];
        const anterior = facturaciones[1];
        
        if (!ultima) {
            return PeriodicidadFacturacion.INDETERMINADA;
        }
        
        const periodoUltimo = ultima.getPeriodo();

        if (!this.esPeriodoMensual(
            periodoUltimo.desde,
            periodoUltimo.hasta
        )) {
            return PeriodicidadFacturacion.NO_MENSUAL;
        }

        if (!anterior) {
            return PeriodicidadFacturacion.INDETERMINADA;
        }

        const periodoAnterior = anterior.getPeriodo();

        const anteriorMensual = this.esPeriodoMensual(
            periodoAnterior.desde,
            periodoAnterior.hasta
        );

        const consecutivas =
            periodoAnterior.hasta.getTime() ===
            periodoUltimo.desde.getTime();

        if (anteriorMensual && consecutivas) {
            return PeriodicidadFacturacion.MENSUAL;
        }

        return PeriodicidadFacturacion.INDETERMINADA;
    }

    /**
     * Comprueba si un período representa un mes calendario.
     * Contempla meses de distinta duración.
     */
    private esPeriodoMensual(desde: Date, hasta: Date): boolean {

        if (
            Number.isNaN(desde.getTime()) ||
            Number.isNaN(hasta.getTime()) ||
            hasta <= desde
        ) {
            return false;
        }

        const siguienteMes = new Date(desde);

        const diaOriginal = siguienteMes.getUTCDate();

        siguienteMes.setUTCDate(1);
        siguienteMes.setUTCMonth(siguienteMes.getUTCMonth() + 1);

        const ultimoDiaMes = new Date(Date.UTC(
            siguienteMes.getUTCFullYear(),
            siguienteMes.getUTCMonth() + 1,
            0
        )).getUTCDate();

        siguienteMes.setUTCDate(
            Math.min(diaOriginal, ultimoDiaMes)
        );

        return siguienteMes.getTime() === hasta.getTime();
    }




    /**
     * Obtiene el último detalle económico y determina
     * la periodicidad de facturación en un solo recorrido.
     *
     * No realiza escrituras en Firestore.
     */
    async analizarFacturacion(
        poliza: number,
        endosoActual: number,
        detalleActual?: MercantilDetallePolizaManager
    ): Promise<{
        detalleFacturacion: MercantilDetallePolizaManager;
        periodicidadFacturacion: PeriodicidadFacturacion;
    }> {

        const facturaciones: MercantilDetallePolizaManager[] = [];

        let detalleEndosoCero: MercantilDetallePolizaManager | null = null;
        let consultasIncompletas = false;

        for (let endoso = endosoActual; endoso >= 0; endoso--) {

            try {
                const detalle =  endoso === endosoActual && detalleActual
            ? detalleActual
            : await this.obtenerDetallePoliza(poliza, endoso);

                const tipo = detalle.getTipo()?.trim().toUpperCase();

                if (tipo === "FACTURACION") {
                    facturaciones.push(detalle);

                    if (facturaciones.length === 2) {
                        break;
                    }
                }

                if (endoso === 0) {
                    detalleEndosoCero = detalle;
                }

            } catch (error) {
                consultasIncompletas = true;

                console.warn(
                    `No se pudo consultar el endoso ${endoso} ` +
                    `de la póliza ${poliza} al analizar facturación.`
                );
            }
        }

        const ultimaFacturacion = facturaciones[0];

        const detalleFacturacion =
            ultimaFacturacion ?? detalleEndosoCero;

        if (!detalleFacturacion) {
            throw new Error(
                `No se encontró una facturación ni un endoso 0 válido ` +
                `para la póliza ${poliza}.`
            );
        }

        let periodicidadFacturacion =
            PeriodicidadFacturacion.INDETERMINADA;

        if (!consultasIncompletas && ultimaFacturacion) {

            const periodoUltimo = ultimaFacturacion.getPeriodo();

            if (!this.esPeriodoMensual(
                periodoUltimo.desde,
                periodoUltimo.hasta
            )) {

                periodicidadFacturacion =
                    PeriodicidadFacturacion.NO_MENSUAL;

            } else {

                const anterior = facturaciones[1];

                if (anterior) {

                    const periodoAnterior = anterior.getPeriodo();

                    const anteriorMensual = this.esPeriodoMensual(
                        periodoAnterior.desde,
                        periodoAnterior.hasta
                    );

                    const consecutivas =
                        periodoAnterior.hasta.getTime() ===
                        periodoUltimo.desde.getTime();

                    if (anteriorMensual && consecutivas) {
                        periodicidadFacturacion =
                            PeriodicidadFacturacion.MENSUAL;
                    }
                }
            }
        }

        return {
            detalleFacturacion,
            periodicidadFacturacion
        };
    }




    /**
     * Obtiene el detalle económico representativo de una póliza de Mercantil Andina.
     *
     * Mercantil puede informar como endoso actual un movimiento que no representa
     * la facturación normal de la póliza. Por ejemplo, un endoso de inclusión o
     * exclusión de vehículo puede contener una prima y un premio correspondientes
     * únicamente al ajuste generado por ese movimiento.
     *
     * Por este motivo, no se debe utilizar necesariamente la prima y el premio del
     * endoso actual como valores representativos de la póliza.
     *
     * El método recorre los endosos desde el endoso actual hacia atrás hasta
     * encontrar el último detalle cuyo tipo sea "FACTURACION".
     *
     * Ejemplo:
     *
     * Endoso 7 -> ENDOSO      -> inclusión/exclusión de vehículo
     * Endoso 6 -> FACTURACION -> se utiliza para prima/premio
     *
     * De esta manera:
     * - el endoso actual continúa representando el estado vigente de la póliza;
     * - la cobertura y los bienes pueden obtenerse del endoso actual;
     * - la prima y el premio se obtienen de la última facturación disponible.
     *
     * El endoso 0 corresponde a la emisión inicial de la póliza ("NUEVA").
     * Si no existe ningún endoso de tipo "FACTURACION" entre el endoso actual
     * y el endoso 1, se utiliza el detalle del endoso 0 como fallback. Esto
     * contempla pólizas nuevas que todavía no poseen una facturación posterior.
     *
     * Los importes de los distintos endosos NO se suman, ya que los endosos de
     * tipo FACTURACION pueden corresponder a períodos de facturación diferentes
     * y los endosos comunes pueden representar únicamente ajustes económicos.
     *
     * @param poliza Número de póliza de Mercantil Andina.
     * @param endosoActual Número del endoso vigente informado por la cartera.
     * @returns El detalle correspondiente a la última facturación disponible,
     * o el detalle del endoso 0 cuando todavía no existe una facturación posterior.
     * @throws Error si no es posible obtener ningún detalle válido para utilizar
     * como referencia económica.
     */
    async obtenerUltimaFacturacion(poliza: number,endosoActual: number): Promise<MercantilDetallePolizaManager> {

        let detalleEndosoCero: MercantilDetallePolizaManager | null = null;

        for (let endoso = endosoActual; endoso >= 0; endoso--) {

            try {

                const detalle = await this.obtenerDetallePoliza(
                    poliza,
                    endoso
                );

                const tipo = detalle.getTipo()?.trim().toUpperCase();

                if (tipo === "FACTURACION") {
                    return detalle;
                }

                if (endoso === 0) {
                    detalleEndosoCero = detalle;
                }

            } catch (error) {

                console.warn(
                    `No se pudo consultar el detalle de la póliza ${poliza}, ` +
                    `endoso ${endoso}, al buscar la última facturación.`
                );

                /*
                * Continuamos hacia atrás porque la ausencia o error de un
                * endoso intermedio no implica necesariamente que no exista
                * una facturación anterior válida.
                */
                continue;
            }
        }

        if (detalleEndosoCero) {
            return detalleEndosoCero;
        }

        throw new Error(
            `No se encontró una facturación ni un endoso 0 válido ` +
            `para la póliza ${poliza}.`
        );
    }

}
