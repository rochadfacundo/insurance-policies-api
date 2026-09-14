import { FirestorePolizaRepository } from "../repositories/firestorePolizaRepository";
import { FirestoreProductorEjecutivaRepository } from "../repositories/firestoreProductorEjecutivaRepository";

import { Poliza } from "../models/poliza";
import { RenovacionesEjecutiva } from "../models/renovacionesEjecutiva";

export class RenovacionesService {

    private readonly polizaRepository: FirestorePolizaRepository;

    private readonly productorEjecutivaRepository: FirestoreProductorEjecutivaRepository;


    constructor() {

        this.polizaRepository = new FirestorePolizaRepository();

        this.productorEjecutivaRepository = new FirestoreProductorEjecutivaRepository();
    }


    /**
     * Obtiene las pólizas que vencen
     * durante el mes siguiente.
     */
    async obtenerRenovacionesMesSiguiente(fechaReferencia: Date = new Date()): Promise<Poliza[]> {

        const desde = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 1, 1);

        desde.setHours(0, 0, 0, 0);


        const hasta = new Date(fechaReferencia.getFullYear(),fechaReferencia.getMonth() + 2,0);

        hasta.setHours(23, 59, 59, 999);


        return this.polizaRepository.obtenerProximasAVencer(desde, hasta);
    }


    /**
     * Obtiene las renovaciones del mes siguiente
     * agrupadas por ejecutiva.
     */
    async obtenerRenovacionesPorEjecutiva(fechaReferencia: Date = new Date()): Promise<RenovacionesEjecutiva[]> {

        const polizas = await this.obtenerRenovacionesMesSiguiente(fechaReferencia);

        const relaciones = await this.productorEjecutivaRepository.obtenerTodos();


        /*
         * Generamos un mapa:
         *
         * codigoProductor -> relación productor/ejecutiva
         */
        const relacionesPorProductor = new Map( relaciones.map(
                    relacion => [
                        relacion.productor.codigo,
                        relacion
                    ]
                )
            );


        /*
         * Agrupamos las pólizas por ejecutiva.
         */
        const agrupadas = new Map<string, RenovacionesEjecutiva>();


        for (const poliza of polizas) {

            const relacion = relacionesPorProductor.get(poliza.productor.codigo);


            /*
             * Si el productor todavía no tiene
             * ejecutiva asignada, no podemos
             * agruparlo.
             */
            if (!relacion) {

                console.warn(
                    `Productor sin ejecutiva: ` +
                    `${poliza.productor.codigo} - ` +
                    `${poliza.productor.nombre}`
                );

                continue;
            }


            const idEjecutiva = relacion.ejecutiva.id;


            let grupo = agrupadas.get(idEjecutiva);


            if (!grupo) {

                grupo = {
                    ejecutiva: relacion.ejecutiva,

                    polizas: []
                };

                agrupadas.set(idEjecutiva, grupo);
            }


            grupo.polizas.push(poliza);
        }


        return Array.from(agrupadas.values());
    }
}