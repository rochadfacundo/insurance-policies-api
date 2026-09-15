import { FirestorePolizaRepository } from "../repositories/firestorePolizaRepository";
import { FirestoreProductorEjecutivaRepository } from "../repositories/firestoreProductorEjecutivaRepository";
import { FirestoreEjecutivaRepository } from "../repositories/firestoreEjecutivaRepository";

import { Poliza } from "../models/poliza";
import { RenovacionesEjecutiva } from "../models/renovacionesEjecutiva";


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
     * Obtiene las pólizas cuyo vencimiento ocurre durante
     * el mes calendario siguiente a la fecha de referencia.
     *
     * El rango comprende desde el primer instante del primer
     * día del mes siguiente hasta el último instante del
     * último día de dicho mes.
     *
     * Ejemplo:
     *
     * Si fechaReferencia es 20/09/2026:
     *
     *      desde: 01/10/2026 00:00:00.000
     *      hasta: 31/10/2026 23:59:59.999
     *
     * La fecha de referencia se recibe como parámetro para
     * permitir utilizar la fecha actual en producción y fechas
     * simuladas durante pruebas.
     *
     * @param fechaReferencia fecha utilizada para determinar
     * el mes cuyas renovaciones deben consultarse.
     *
     * @returns listado de pólizas que vencen durante
     * el mes calendario siguiente.
     *
     * @see Poliza
     * @see FirestorePolizaRepository
     */
    async obtenerRenovacionesMesSiguiente(fechaReferencia: Date = new Date()): Promise<Poliza[]> {

        /*
         * Primer día del mes siguiente.
         *
         * JavaScript resuelve automáticamente los cambios
         * de año al incrementar el número de mes.
         *
         * Ejemplo:
         *
         * diciembre 2026 + 1 mes -> enero 2027.
         */
        const desde = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 1, 1);
        desde.setHours(0, 0, 0, 0);


        /*
         * El día 0 del mes posterior representa el último
         * día del mes que necesitamos consultar.
         *
         * Ejemplo:
         *
         * new Date(2026, 10, 0)
         *
         * devuelve el último día de octubre de 2026.
         */
        const hasta = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 2,0);
        hasta.setHours(23, 59, 59, 999);


        /*
         * El service determina el rango temporal correspondiente
         * a la regla de negocio y delega al repository el acceso
         * a Firestore.
         */
        return this.polizaRepository.obtenerProximasAVencer(desde, hasta);
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
     * Si una póliza pertenece a un productor que no posee
     * relación configurada, la póliza se omite y se registra
     * una advertencia.
     *
     * Si la relación existe pero la ejecutiva asociada no
     * existe o se encuentra inactiva, también se omite la
     * póliza y se registra una advertencia.
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


            /*
             * Si no existe una relación configurada para
             * este productor, no podemos determinar qué
             * ejecutiva debe recibir la renovación.
             */
            if (!relacion) {

                console.warn(`Productor sin ejecutiva asignada: ` + `${poliza.compania} - ` +
                    `${poliza.productor.codigo} - ` + `${poliza.productor.nombre}`
                );

                continue;
            }


            /*
             * A partir del ejecutivaId almacenado en la
             * relación obtenemos los datos completos de
             * la ejecutiva.
             *
             * El Map contiene solamente ejecutivas activas.
             */
            const ejecutiva = ejecutivasPorId.get(relacion.ejecutivaId);


            /*
             * Si no encontramos la ejecutiva significa que:
             *
             * - el ID configurado en la relación no existe, o
             * - la ejecutiva existe pero está inactiva.
             *
             * En cualquiera de los dos casos evitamos incluir
             * la póliza en el proceso automático.
             */
            if (!ejecutiva) {

                console.warn(`Ejecutiva inexistente o inactiva: ` + `${relacion.ejecutivaId} - ` +
                    `Productor: ${poliza.compania} - ` + `${poliza.productor.codigo} - ` + `${poliza.productor.nombre}`);

                continue;
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
}