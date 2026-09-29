import {
    Firestore,
    WriteBatch
} from "firebase-admin/firestore";

import { FirebaseConfig }
    from "../../../config/firebaseConfig";

import { FedPatPolizaState }
    from "../models/fedPatPolizaState";


/**
 * Repositorio encargado de persistir en Firestore el estado
 * acumulado de las pólizas obtenidas desde la API de Cartera
 * de Federación Patronal.
 *
 * Este repositorio almacena información técnica/raw utilizada
 * para reconstruir una póliza a partir de los feeds diarios.
 *
 * No guarda las pólizas normalizadas que consume la aplicación.
 * Esa responsabilidad continúa perteneciendo a
 * FirestorePolizaRepository.
 */
export class FirestoreFedPatPolizaStateRepository {

    /**
     * Colección independiente utilizada para almacenar el estado
     * acumulado de Federación Patronal.
     *
     * Se mantiene separada de "polizas" porque estos documentos
     * contienen información interna necesaria para reconstruir
     * el estado a partir de movimientos diarios.
     */
    private readonly COLLECTION_NAME =
        "fedPatPolizaStates";

    /**
     * Firestore admite batches de hasta 500 operaciones.
     *
     * Utilizamos 400 para mantener margen y seguir el mismo
     * criterio utilizado por FirestorePolizaRepository.
     */
    private readonly BATCH_SIZE = 400;

    private readonly firestore: Firestore;


    /**
     * Inicializa el repositorio utilizando la configuración
     * centralizada de Firebase del proyecto.
     */
    constructor() {

        this.firestore =
            FirebaseConfig.getFirestore();
    }


    /**
     * Obtiene el estado acumulado de una póliza de Federación
     * Patronal utilizando ramo + número de póliza.
     *
     * @param codigoRamo código de ramo informado por Federación.
     * @param numeroPoliza número de póliza informado por Federación.
     * @returns estado acumulado o null si todavía no fue persistido.
     */
    async obtener(
        codigoRamo: number,
        numeroPoliza: number
    ): Promise<FedPatPolizaState | null> {

        const id =
            this.construirId(
                codigoRamo,
                numeroPoliza
            );

        const documento =
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(id)
                .get();


        if (!documento.exists) {
            return null;
        }


        const datos =
            documento.data();

        if (!datos) {
            return null;
        }


        return {
            ...datos,

            codigoRamo:
                datos["codigoRamo"],

            numeroPoliza:
                datos["numeroPoliza"],

            certificados:
                datos["certificados"] ?? [],

            endosos:
                datos["endosos"] ?? [],

            sumas:
                datos["sumas"] ?? [],

            productosDatos:
                datos["productosDatos"] ?? [],

            riesgosCubiertos:
                datos["riesgosCubiertos"] ?? [],

            componentes:
                datos["componentes"] ?? [],

            ultimaFechaProcesada:
                datos["ultimaFechaProcesada"]

        } as FedPatPolizaState;
    }


    /**
     * Guarda o reemplaza completamente el estado acumulado
     * de una póliza.
     *
     * Utilizamos set sin merge porque FedPatPolizaState representa
     * el snapshot técnico completo conocido de la póliza.
     *
     * Esto evita conservar arrays o propiedades antiguas que ya no
     * formen parte del estado reconstruido en memoria.
     *
     * @param estado estado acumulado que se desea persistir.
     */
    async guardar(
        estado: FedPatPolizaState
    ): Promise<void> {

        const id =
            this.construirId(
                estado.codigoRamo,
                estado.numeroPoliza
            );

        const referencia =
            this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(id);


        const datos =
            this.prepararDocumento(
                estado
            );


        await referencia.set(
            datos
        );
    }


    /**
     * Guarda múltiples estados acumulados utilizando batches
     * de Firestore.
     *
     * Los estados se dividen en lotes para no alcanzar el límite
     * máximo de operaciones permitido por un WriteBatch.
     *
     * @param estados estados acumulados que se desean persistir.
     */
    async guardarMuchos(
        estados: FedPatPolizaState[]
    ): Promise<void> {

        if (estados.length === 0) {
            return;
        }


        for (
            let indice = 0;
            indice < estados.length;
            indice += this.BATCH_SIZE
        ) {

            const lote =
                estados.slice(
                    indice,
                    indice + this.BATCH_SIZE
                );


            await this.guardarLote(
                lote
            );
        }
    }


    /**
     * Ejecuta la escritura de un conjunto de estados dentro
     * de un único WriteBatch.
     *
     * Cada documento reemplaza completamente el estado anterior
     * de esa póliza.
     *
     * @param estados subconjunto de estados a persistir.
     */
    private async guardarLote(
        estados: FedPatPolizaState[]
    ): Promise<void> {

        const batch: WriteBatch =
            this.firestore.batch();


        for (const estado of estados) {

            const id =
                this.construirId(
                    estado.codigoRamo,
                    estado.numeroPoliza
                );


            const referencia =
                this.firestore
                    .collection(this.COLLECTION_NAME)
                    .doc(id);


            const datos =
                this.prepararDocumento(
                    estado
                );


            batch.set(
                referencia,
                datos
            );
        }


        await batch.commit();
    }


    /**
     * Construye el identificador único utilizado en Firestore.
     *
     * El número de póliza no se considera globalmente único,
     * por lo que el ID incluye también el ramo.
     *
     * Ejemplo:
     *
     * FEDPAT_4_35274952
     *
     * @param codigoRamo código de ramo de Federación.
     * @param numeroPoliza número de póliza.
     */
    construirId(
        codigoRamo: number,
        numeroPoliza: number
    ): string {

        return (
            `FEDPAT_${codigoRamo}_${numeroPoliza}`
        );
    }


    /**
     * Prepara el estado para su almacenamiento en Firestore.
     *
     * Actualmente FedPatPolizaState contiene principalmente
     * estructuras primitivas provenientes de la API. De todas
     * formas se eliminan recursivamente propiedades undefined
     * para evitar errores de serialización de Firestore.
     *
     * @param estado estado acumulado a preparar.
     */
    private prepararDocumento(
        estado: FedPatPolizaState
    ): Record<string, unknown> {

        return this.eliminarUndefined<
            Record<string, unknown>
        >({
            ...estado
        });
    }


    /**
     * Elimina recursivamente propiedades con valor undefined.
     *
     * Firestore no admite undefined de forma predeterminada,
     * incluyendo valores ubicados dentro de objetos o arrays
     * anidados.
     *
     * @param valor objeto o array que se desea limpiar.
     * @returns una nueva estructura sin propiedades undefined.
     */
    private eliminarUndefined<T>(
        valor: T
    ): T {

        if (Array.isArray(valor)) {

            return valor
                .filter(
                    item =>
                        item !== undefined
                )
                .map(
                    item =>
                        this.eliminarUndefined(item)
                ) as T;
        }


        if (
            valor !== null &&
            typeof valor === "object"
        ) {

            return Object.fromEntries(
                Object.entries(valor)
                    .filter(
                        ([, contenido]) =>
                            contenido !== undefined
                    )
                    .map(
                        ([clave, contenido]) => [
                            clave,
                            this.eliminarUndefined(
                                contenido
                            )
                        ]
                    )
            ) as T;
        }


        return valor;
    }
}