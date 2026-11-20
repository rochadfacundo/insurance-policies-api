import { FirestorePolizaRepository } from "../repositories/firestorePolizaRepository";
import { FirestoreProductorEjecutivaRepository } from "../repositories/firestoreProductorEjecutivaRepository";
import { FirestoreEjecutivaRepository } from "../repositories/firestoreEjecutivaRepository";

import { Poliza } from "../models/poliza";
import { RenovacionesEjecutiva } from "../models/renovacionesEjecutiva";
import { EstadoRefacturacion } from "../models/estadoRefacturacion";
import { ECompania } from "../models/eCompania";


/**
 * Servicio encargado de obtener y organizar las pólizas
 * próximas a renovar.
 *
 * El proceso trabaja sobre las pólizas almacenadas en Firestore
 * y permite:
 *
 * 1. Obtener las pólizas cuyo vencimiento ocurre durante
 *    el mes calendario siguiente a una fecha de referencia.
 *
 * 2. Relacionar cada póliza con el productor correspondiente
 *    utilizando la combinación compañía + código de productor.
 *
 * 3. Obtener la ejecutiva responsable mediante la relación
 *    configurada en la colección "productoresEjecutivas".
 *
 * 4. Agrupar las pólizas por ejecutiva para posteriormente
 *    generar y enviar los reportes de renovaciones.
 *
 * La relación completa es:
 *
 *      Poliza
 *          ↓
 *      compañía + códigoProductor
 *          ↓
 *      ProductorEjecutiva
 *          ↓
 *      ejecutivaId
 *          ↓
 *      Ejecutiva
 *
 * El código del productor no puede utilizarse de manera
 * independiente porque pertenece al dominio de cada compañía
 * y puede repetirse entre compañías diferentes.
 */
export class RenovacionesService {

    //Si no hay productor asociado lo enviamos a Mica
    private readonly EJECUTIVA_DEFAULT_ID = "micaela-rocha";

    private polizasExcluidas: {
        poliza: Poliza;
        motivo: string;
    }[] = [];
    
    public obtenerPolizasExcluidas(): {
        poliza: Poliza;
        motivo: string;
    }[] {
        return [...this.polizasExcluidas];
    }

    /**
 * Exclusión temporal para el reporte de diciembre de 2026.
 * Pólizas Mercantil con períodos mensuales detectados en la auditoría.
 *
 * IMPORTANTE: reemplazar por detección automática de periodicidad.
 */
private readonly POLIZAS_MERCANTIL_MENSUALES = new Set([
    516739464,
    516889532,
    516863085,
    516890062,
    517370668,
    516950802,
    516556190,
    517157666,
    517372421,
    516735589,
    516800324,
    517188303,
    516810315,
    171969982,
    517176710,
    517261449,
    517356083
]);

    /**
     * Repository utilizado para consultar las pólizas
     * almacenadas en Firestore.
     */
    private readonly polizaRepository: FirestorePolizaRepository;

    /**
     * Repository utilizado para consultar las relaciones
     * entre productores y ejecutivas.
     */
    private readonly productorEjecutivaRepository: FirestoreProductorEjecutivaRepository;

    /**
     * Repository utilizado para consultar las ejecutivas
     * configuradas en el sistema.
     */
    private readonly ejecutivaRepository: FirestoreEjecutivaRepository;


    /**
     * Inicializa los repositories necesarios para ejecutar
     * el proceso de renovaciones.
     */
    constructor() {

        this.polizaRepository = new FirestorePolizaRepository();
        this.productorEjecutivaRepository = new FirestoreProductorEjecutivaRepository();
        this.ejecutivaRepository = new FirestoreEjecutivaRepository();
    }


    
    /**
     * Obtiene las pólizas cuya próxima gestión corresponde
     * al mes calendario siguiente a la fecha de referencia.
     *
     * La fecha de gestión puede representar una refacturación
     * pendiente o el vencimiento definitivo de la póliza.
     *
     * @param fechaReferencia Fecha utilizada para determinar el período.
     * @returns Pólizas con próxima gestión durante el mes siguiente.
     */
    async obtenerRenovacionesMesSiguiente(fechaReferencia: Date = new Date()): Promise<Poliza[]> {

        const desde = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 1, 1);
        desde.setHours(0, 0, 0, 0);

        const hasta = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 2, 0);
        hasta.setHours(23, 59, 59, 999);

        // Obtenemos las pólizas candidatas según ambas fechas.
        const polizas = await this.polizaRepository.obtenerProximasAGestionar(desde,hasta);


        this.polizasExcluidas = [];

        /*
        * Conservamos únicamente las pólizas con riesgos detectados
        * y cuya próxima gestión corresponde al mes solicitado.
        *
        * Utilizamos el mismo criterio de fechas que RiesgoService
        * en Angular.
        */
        return polizas.filter(poliza => {

            if (!Array.isArray(poliza.riesgos) || poliza.riesgos.length === 0) {
                return false;
            }
        
            const fechaGestion = this.obtenerFechaProximaGestion(poliza);
        
            if (
                fechaGestion === null ||
                fechaGestion < desde ||
                fechaGestion > hasta
            ) {
                return false;
            }
        
            // Exclusión temporal de facturaciones mensuales de Mercantil.
            if (
                poliza.compania === ECompania.MERCANTIL_ANDINA &&
                this.POLIZAS_MERCANTIL_MENSUALES.has(
                    Number(poliza.detallePoliza.numeroPoliza)
                )
            ) {

                this.polizasExcluidas.push({
                    poliza,
                    motivo: "Facturación mensual Mercantil Andina - exclusión temporal"
                });
                console.log(
                    `[RENOVACIONES] Excluida Mercantil mensual: ${poliza.detallePoliza.numeroPoliza}`
                );
        
                return false;
            }
        
// Excluir refacturación mensual de Federación Patronal.
if (
    poliza.compania === ECompania.FEDERACION_PATRONAL &&
    poliza.tipoProximaGestion === "REFACTURACION" &&
    poliza.facturacion?.desde &&
    poliza.facturacion?.hasta
) {
    const desdeFacturacion = poliza.facturacion.desde;
    const hastaFacturacion = poliza.facturacion.hasta;

    const unMesDespues = new Date(desdeFacturacion);
    unMesDespues.setMonth(unMesDespues.getMonth() + 1);

    if (
        unMesDespues.getFullYear() === hastaFacturacion.getFullYear() &&
        unMesDespues.getMonth() === hastaFacturacion.getMonth() &&
        unMesDespues.getDate() === hastaFacturacion.getDate()
    ) {
        this.polizasExcluidas.push({
            poliza,
            motivo: "Refacturación mensual Federación Patronal"
        });
    
        console.log(
            `[RENOVACIONES] Excluida Federación mensual: ${poliza.detallePoliza.numeroPoliza}`
        );
    
        return false;
    }
}


            return true;
        });
    }



    /**
     * Obtiene las pólizas que vencen durante el mes siguiente
     * y las agrupa según la ejecutiva responsable.
     *
     * Para evitar consultas individuales a Firestore durante
     * el procesamiento de cada póliza, se cargan inicialmente:
     *
     * - todas las relaciones productor-ejecutiva;
     * - todas las ejecutivas activas.
     *
     * A partir de estos datos se construyen Maps en memoria
     * que permiten resolver las relaciones mediante acceso
     * directo.
     *
     * El proceso general es:
     *
     * 1. Obtener las pólizas próximas a vencer.
     * 2. Obtener las relaciones productor-ejecutiva.
     * 3. Obtener las ejecutivas activas.
     * 4. Indexar las relaciones por compañía + código.
     * 5. Indexar las ejecutivas por ID.
     * 6. Resolver la ejecutiva correspondiente a cada póliza.
     * 7. Agrupar las pólizas por ejecutiva.
     *
     *
     * Si una póliza pertenece a un productor sin relación
     * configurada, se asigna virtualmente a Micaela Rocha.
     *
     * Esta asignación se utiliza exclusivamente para agrupar
     * las renovaciones. No se persiste en Firestore.
     *
     * Si existe una relación con una ejecutiva inexistente
   * o inactiva, se registra una advertencia y se omite.
     *
     *
     * @param fechaReferencia fecha utilizada para determinar
     * el mes cuyas renovaciones deben procesarse.
     *
     * @returns listado de ejecutivas activas junto con las
     * pólizas próximas a renovar correspondientes a sus
     * productores.
     *
     * @see RenovacionesEjecutiva
     * @see FirestoreProductorEjecutivaRepository
     * @see FirestoreEjecutivaRepository
     */
    async obtenerRenovacionesPorEjecutiva(fechaReferencia: Date = new Date()): Promise<RenovacionesEjecutiva[]> {

        /*
         * Obtenemos las pólizas que vencen durante
         * el mes calendario siguiente.
         */
        const polizas = await this.obtenerRenovacionesMesSiguiente(fechaReferencia);


        /*
         * Obtenemos todas las relaciones entre productores
         * y ejecutivas configuradas en Firestore.
         */
        const relaciones = await this.productorEjecutivaRepository.obtenerTodos();


        /*
         * Obtenemos únicamente las ejecutivas activas.
         *
         * De esta manera una ejecutiva dada de baja lógicamente
         * no participa del proceso de renovaciones aunque todavía
         * existan relaciones históricas que hagan referencia
         * a su ID.
         */
        const ejecutivas = await this.ejecutivaRepository.obtenerActivas();


        /*
         * Indexamos las relaciones productor-ejecutiva.
         *
         * Clave:
         *
         *      compania_codigoProductor
         *
         * Valor:
         *
         *      ProductorEjecutiva
         *
         * Ejemplos:
         *
         *      RIO_URUGUAY_4666
         *      MERCANTIL_ANDINA_97521
         *
         * La compañía forma parte de la clave porque los
         * códigos de productor no son globalmente únicos.
         */
        const relacionesPorProductor = new Map(relaciones.map(
                relacion => [
                    `${relacion.compania}_${relacion.productor.codigo}`,
                    relacion
                ]
            )
        );


        /*
         * Indexamos las ejecutivas activas mediante su ID.
         *
         * Ejemplo:
         *
         *      andrea-collia
         *          ->
         *      {
         *          id: "andrea-collia",
         *          nombre: "Andrea",
         *          apellido: "Collia",
         *          email: "...",
         *          activa: true
         *      }
         *
         * Esto permite obtener la información completa de
         * una ejecutiva a partir del ejecutivaId almacenado
         * en ProductorEjecutiva.
         */
        const ejecutivasPorId = new Map(ejecutivas.map(
                ejecutiva => [
                    ejecutiva.id,
                    ejecutiva
                ]
            )
        );

        const ejecutivaDefault = ejecutivasPorId.get(this.EJECUTIVA_DEFAULT_ID);
        
        if (!ejecutivaDefault) {
            throw new Error(
                `La ejecutiva por defecto ${this.EJECUTIVA_DEFAULT_ID} ` +
                `no existe o está inactiva.`
            );
        }


        /*
         * Mapa utilizado para construir el resultado final.
         *
         * Clave:
         *
         *      ID de la ejecutiva.
         *
         * Valor:
         *
         *      RenovacionesEjecutiva
         *
         * Cada entrada contiene la ejecutiva y todas las
         * pólizas próximas a renovar que le corresponden.
         */
        const agrupadas = new Map<string, RenovacionesEjecutiva>();


        /*
         * Procesamos cada póliza próxima a vencer.
         */
        for (const poliza of polizas) {

            /*
             * Construimos la clave utilizada para identificar
             * al productor dentro de una compañía.
             */
            const claveProductor = `${poliza.compania}_${poliza.productor.codigo}`;


            /*
             * Buscamos la relación productor-ejecutiva.
             */
            
            const relacion = relacionesPorProductor.get(claveProductor);

            let ejecutiva;

            if (!relacion) {

                // No existe relación: asignación virtual a Micaela.
                ejecutiva = ejecutivaDefault;

                console.warn(
                    `[RENOVACIONES] Productor sin relación. ` +
                    `Asignado por defecto a ${ejecutiva.nombre} ${ejecutiva.apellido}: ` +
                    `${poliza.compania} - ` +
                    `${poliza.productor.codigo} - ` +
                    `${poliza.productor.nombre}`
                );

            } else {

                // Existe relación: respetamos la ejecutiva configurada.
                ejecutiva = ejecutivasPorId.get(relacion.ejecutivaId);

                if (!ejecutiva) {

                    console.warn(
                        `[RENOVACIONES] Ejecutiva inexistente o inactiva: ` +
                        `${relacion.ejecutivaId} - ` +
                        `Productor: ${poliza.compania} - ` +
                        `${poliza.productor.codigo} - ` +
                        `${poliza.productor.nombre}`
                    );

                    continue;
                }
            }


        


            /*
             * Buscamos si ya existe un grupo de renovaciones
             * para esta ejecutiva.
             */
            let grupo = agrupadas.get(ejecutiva.id);


            /*
             * Si es la primera póliza encontrada para esta
             * ejecutiva, inicializamos su grupo.
             */
            if (!grupo) {

                grupo = {
                    ejecutiva,
                    polizas: []
                };

                agrupadas.set(ejecutiva.id, grupo);
            }


            /*
             * Incorporamos la póliza al grupo correspondiente.
             */
            grupo.polizas.push(poliza);
        }


        /*
         * Convertimos el Map utilizado internamente
         * al array esperado por el resto del proceso.
         */
        return Array.from(agrupadas.values());
    }


    

    /**
     * Determina la fecha de próxima gestión de una póliza
     * utilizando el mismo criterio que el frontend Angular.
     *
     * Mercantil Andina y Río Uruguay:
     *   - Fecha de finalización del período de facturación.
     *
     * Federación Patronal:
     *   - Fecha de próxima gestión calculada por el backend,
     *     que puede representar renovación o refacturación.
     *
     * @param poliza Póliza que se desea evaluar.
     * @returns Fecha de próxima gestión o null.
     */
    public obtenerFechaProximaGestion(poliza: Poliza): Date | null {

        if (poliza.compania === ECompania.FEDERACION_PATRONAL) {
            return poliza.fechaProximaGestion ?? null;
        }

        return poliza.facturacion?.hasta ?? null;
    }





}