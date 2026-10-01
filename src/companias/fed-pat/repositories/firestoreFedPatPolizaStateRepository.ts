import {
    DocumentReference,
    Firestore,
    WriteBatch
} from "firebase-admin/firestore";

import { FirebaseConfig }
    from "../../../config/firebaseConfig";

import { FedPatPolizaState }
    from "../models/fedPatPolizaState";

import { FedPatCertificadoEndoso }
    from "../models/fedPatCertificadoEndoso";

import { FedPatCertificadoSuma }
    from "../models/fedPatCertificadoSuma";

import { FedPatProductoDato }
    from "../models/fedPatProductoDato";

import { FedPatRiesgoCubierto }
    from "../models/fedPatRiesgoCubierto";

import { FedPatCertificadoComponente }
    from "../models/fedPatCertificadoComponente";
import { FedPatCertificado } from "../models/fetPatCertificado";


/**
 * Repositorio encargado de persistir en Firestore el estado técnico
 * acumulado de las pólizas obtenidas desde la API de Cartera de
 * Federación Patronal.
 *
 * El documento principal conserva únicamente metadata de la póliza.
 *
 * Los registros RAW se almacenan en subcolecciones independientes
 * para evitar que pólizas con una gran cantidad de movimientos
 * superen el tamaño máximo permitido para un documento Firestore.
 *
 * Estructura:
 *
 * fedPatPolizaStates/{polizaId}
 *   codigoRamo
 *   numeroPoliza
 *   ultimaFechaProcesada
 *
 *   certificados/{id}
 *   endosos/{id}
 *   sumas/{id}
 *   productosDatos/{id}
 *   riesgosCubiertos/{id}
 *   componentes/{id}
 *
 * Este repositorio almacena únicamente información técnica utilizada
 * para reconstruir FedPatPolizaState.
 *
 * Las pólizas normalizadas que consume la aplicación continúan siendo
 * responsabilidad de FirestorePolizaRepository.
 */
export class FirestoreFedPatPolizaStateRepository {

    /**
     * Colección raíz de estados técnicos de Federación Patronal.
     */
    private readonly COLLECTION_NAME =
        "fedPatPolizaStates";


    /**
     * Subcolecciones utilizadas para almacenar los diferentes tipos
     * de registros RAW que componen FedPatPolizaState.
     */
    private readonly SUBCOLLECTION_CERTIFICADOS =
        "certificados";

    private readonly SUBCOLLECTION_ENDOSOS =
        "endosos";

    private readonly SUBCOLLECTION_SUMAS =
        "sumas";

    private readonly SUBCOLLECTION_PRODUCTOS_DATOS =
        "productosDatos";

    private readonly SUBCOLLECTION_RIESGOS_CUBIERTOS =
        "riesgosCubiertos";

    private readonly SUBCOLLECTION_COMPONENTES =
        "componentes";


    /**
     * Firestore admite una cantidad limitada de operaciones dentro
     * de un WriteBatch.
     *
     * Utilizamos 400 operaciones por lote para mantener margen y
     * evitar trabajar exactamente sobre el límite máximo.
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
     * Obtiene el estado técnico acumulado completo de una póliza.
     *
     * El documento padre contiene únicamente metadata.
     *
     * Los seis arrays de FedPatPolizaState se reconstruyen leyendo
     * las subcolecciones correspondientes.
     *
     * De esta manera el dominio continúa trabajando con un único
     * FedPatPolizaState independientemente de cómo esté distribuida
     * físicamente la información en Firestore.
     *
     * @param codigoRamo Código de ramo informado por Federación.
     * @param numeroPoliza Número de póliza informado por Federación.
     * @returns Estado acumulado o null si todavía no fue persistido.
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


        const referencia =
            this.firestore
                .collection(
                    this.COLLECTION_NAME
                )
                .doc(id);


        const documento =
            await referencia.get();


        if (!documento.exists) {

            return null;
        }


        const datos =
            documento.data();


        if (!datos) {

            return null;
        }


        /**
         * Las subcolecciones son independientes entre sí.
         *
         * Las consultas se ejecutan en paralelo para reducir el tiempo
         * necesario para reconstruir el estado completo.
         */
        const [
            certificadosSnapshot,
            endososSnapshot,
            sumasSnapshot,
            productosDatosSnapshot,
            riesgosCubiertosSnapshot,
            componentesSnapshot
        ] = await Promise.all([

            referencia
                .collection(
                    this.SUBCOLLECTION_CERTIFICADOS
                )
                .get(),

            referencia
                .collection(
                    this.SUBCOLLECTION_ENDOSOS
                )
                .get(),

            referencia
                .collection(
                    this.SUBCOLLECTION_SUMAS
                )
                .get(),

            referencia
                .collection(
                    this.SUBCOLLECTION_PRODUCTOS_DATOS
                )
                .get(),

            referencia
                .collection(
                    this.SUBCOLLECTION_RIESGOS_CUBIERTOS
                )
                .get(),

            referencia
                .collection(
                    this.SUBCOLLECTION_COMPONENTES
                )
                .get()
        ]);


        /**
         * Firestore devuelve DocumentData.
         *
         * Como estos documentos fueron persistidos utilizando los
         * modelos RAW correspondientes, reconstruimos los arrays
         * tipados después de leer data().
         *
         * El cast se mantiene en la misma expresión para evitar
         * problemas de parseo de TypeScript.
         */
        const certificados: FedPatCertificado[] =
            certificadosSnapshot.docs.map(
                documentoCertificado =>
                    documentoCertificado.data() as FedPatCertificado
            );


        const endosos: FedPatCertificadoEndoso[] =
            endososSnapshot.docs.map(
                documentoEndoso =>
                    documentoEndoso.data() as FedPatCertificadoEndoso
            );


        const sumas: FedPatCertificadoSuma[] =
            sumasSnapshot.docs.map(
                documentoSuma =>
                    documentoSuma.data() as FedPatCertificadoSuma
            );


        const productosDatos: FedPatProductoDato[] =
            productosDatosSnapshot.docs.map(
                documentoProductoDato =>
                    documentoProductoDato.data() as FedPatProductoDato
            );


        const riesgosCubiertos: FedPatRiesgoCubierto[] =
            riesgosCubiertosSnapshot.docs.map(
                documentoRiesgo =>
                    documentoRiesgo.data() as FedPatRiesgoCubierto
            );


        const componentes: FedPatCertificadoComponente[] =
            componentesSnapshot.docs.map(
                documentoComponente =>
                    documentoComponente.data() as FedPatCertificadoComponente
            );


        return {
            codigoRamo:
                datos["codigoRamo"],

            numeroPoliza:
                datos["numeroPoliza"],

            certificados,

            endosos,

            sumas,

            productosDatos,

            riesgosCubiertos,

            componentes,

            ultimaFechaProcesada:
                datos["ultimaFechaProcesada"]
        };
    }


    /**
     * Guarda el estado técnico acumulado completo de una póliza.
     *
     * Los registros RAW se escriben primero en sus respectivas
     * subcolecciones utilizando IDs determinísticos.
     *
     * El documento padre se actualiza únicamente después de que todos
     * los registros RAW hayan sido persistidos correctamente.
     *
     * Esto evita avanzar `ultimaFechaProcesada` si una escritura falla
     * durante el proceso.
     *
     * @param estado Estado acumulado que se desea persistir.
     */
    async guardar(
        estado: FedPatPolizaState
    ): Promise<void> {

        const referencia =
            this.obtenerReferenciaEstado(
                estado
            );


        /**
         * Primero se persiste el contenido RAW.
         */
        await this.guardarRegistrosEstado(
            referencia,
            estado
        );


        /**
         * El documento padre se escribe al final.
         *
         * Contiene únicamente metadata, por lo que su tamaño permanece
         * pequeño independientemente de la cantidad de movimientos
         * históricos acumulados.
         */
        await referencia.set(
            this.prepararMetadata(
                estado
            )
        );
    }


    /**
     * Guarda múltiples estados acumulados.
     *
     * Una póliza puede representar cientos o miles de operaciones
     * Firestore debido a sus subcolecciones.
     *
     * Por ese motivo cada estado administra internamente los batches
     * necesarios y las pólizas se procesan secuencialmente.
     *
     * Esto evita generar una cantidad excesiva de escrituras
     * simultáneas contra Firestore.
     *
     * @param estados Estados acumulados que se desean persistir.
     */
    async guardarMuchos(
        estados: FedPatPolizaState[]
    ): Promise<void> {

        for (const estado of estados) {

            await this.guardar(
                estado
            );
        }
    }


    /**
     * Persiste todos los registros RAW que componen el estado
     * acumulado de una póliza.
     *
     * Cada registro se transforma en una operación set() con un ID
     * determinístico basado en su clave natural.
     *
     * Esto permite reprocesar información sin generar documentos
     * duplicados.
     *
     * @param referencia Documento padre de la póliza.
     * @param estado Estado técnico acumulado.
     */
    private async guardarRegistrosEstado(
        referencia: DocumentReference,
        estado: FedPatPolizaState
    ): Promise<void> {

        const operaciones:
            Array<(batch: WriteBatch) => void> = [];


        /**
         * CERTIFICADOS
         *
         * Identidad:
         * ramo + póliza + certificado
         */
        for (
            const certificado
            of estado.certificados
        ) {

            const id =
                this.construirIdCertificado(
                    certificado
                );


            const documento =
                this.prepararRegistro(
                    certificado
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_CERTIFICADOS
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        /**
         * ENDOSOS
         *
         * Identidad:
         * ramo + póliza + certificado + endoso
         */
        for (
            const endoso
            of estado.endosos
        ) {

            const id =
                this.construirIdEndoso(
                    endoso
                );


            const documento =
                this.prepararRegistro(
                    endoso
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_ENDOSOS
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        /**
         * SUMAS
         *
         * Identidad:
         * ramo + póliza + certificado
         */
        for (
            const suma
            of estado.sumas
        ) {

            const id =
                this.construirIdSuma(
                    suma
                );


            const documento =
                this.prepararRegistro(
                    suma
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_SUMAS
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        /**
         * PRODUCTOS-DATOS
         *
         * Identidad:
         * ramo + póliza + certificado + endoso + codigo_dato
         */
        for (
            const productoDato
            of estado.productosDatos
        ) {

            const id =
                this.construirIdProductoDato(
                    productoDato
                );


            const documento =
                this.prepararRegistro(
                    productoDato
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_PRODUCTOS_DATOS
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        /**
         * RIESGOS CUBIERTOS
         *
         * Identidad:
         * ramo + póliza + certificado + endoso +
         * codigo_ramo_cobertura + codigo_cobertura
         */
        for (
            const riesgoCubierto
            of estado.riesgosCubiertos
        ) {

            const id =
                this.construirIdRiesgoCubierto(
                    riesgoCubierto
                );


            const documento =
                this.prepararRegistro(
                    riesgoCubierto
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_RIESGOS_CUBIERTOS
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        /**
         * COMPONENTES
         *
         * Identidad:
         * ramo + póliza + certificado + endoso + codigo
         */
        for (
            const componente
            of estado.componentes
        ) {

            const id =
                this.construirIdComponente(
                    componente
                );


            const documento =
                this.prepararRegistro(
                    componente
                );


            operaciones.push(
                (batch: WriteBatch) => {

                    batch.set(
                        referencia
                            .collection(
                                this.SUBCOLLECTION_COMPONENTES
                            )
                            .doc(id),
                        documento
                    );
                }
            );
        }


        await this.ejecutarOperacionesEnBatches(
            operaciones
        );
    }


    /**
     * Ejecuta una colección de operaciones Firestore utilizando
     * WriteBatch de tamaño controlado.
     *
     * Una póliza grande puede requerir múltiples batches.
     *
     * Cada batch se confirma antes de comenzar con el siguiente.
     *
     * @param operaciones Operaciones que deben ejecutarse.
     */
    private async ejecutarOperacionesEnBatches(
        operaciones:
            Array<(batch: WriteBatch) => void>
    ): Promise<void> {

        for (
            let indice = 0;
            indice < operaciones.length;
            indice += this.BATCH_SIZE
        ) {

            const lote =
                operaciones.slice(
                    indice,
                    indice + this.BATCH_SIZE
                );


            const batch: WriteBatch =
                this.firestore.batch();


            for (
                const agregarOperacion
                of lote
            ) {

                agregarOperacion(
                    batch
                );
            }


            await batch.commit();
        }
    }


    /**
     * Obtiene la referencia Firestore correspondiente al documento
     * padre de un estado.
     *
     * @param estado Estado técnico de la póliza.
     * @returns Referencia al documento padre.
     */
    private obtenerReferenciaEstado(
        estado: FedPatPolizaState
    ): DocumentReference {

        const id =
            this.construirId(
                estado.codigoRamo,
                estado.numeroPoliza
            );


        return this.firestore
            .collection(
                this.COLLECTION_NAME
            )
            .doc(id);
    }


    /**
     * Construye el identificador único del documento padre.
     *
     * El número de póliza no se considera globalmente único,
     * por lo que también se incluye el código de ramo.
     *
     * Ejemplo:
     *
     * FEDPAT_4_35274952
     *
     * @param codigoRamo Código de ramo de Federación.
     * @param numeroPoliza Número de póliza.
     * @returns ID utilizado por Firestore.
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
     * Construye la clave natural de un certificado.
     */
    private construirIdCertificado(
        certificado: FedPatCertificado
    ): string {

        return [
            certificado.codigo_ramo,
            certificado.numero_poliza,
            certificado.certificado
        ].join("_");
    }


    /**
     * Construye la clave natural de un endoso.
     */
    private construirIdEndoso(
        endoso: FedPatCertificadoEndoso
    ): string {

        return [
            endoso.codigo_ramo,
            endoso.numero_poliza,
            endoso.certificado,
            endoso.endoso
        ].join("_");
    }


    /**
     * Construye la clave natural de un registro de sumas.
     */
    private construirIdSuma(
        suma: FedPatCertificadoSuma
    ): string {

        return [
            suma.codigo_ramo,
            suma.numero_poliza,
            suma.certificado
        ].join("_");
    }


    /**
     * Construye la clave natural de un producto-dato.
     *
     * La combinación coincide con la utilizada durante la
     * acumulación del estado RAW:
     *
     * ramo + póliza + certificado + endoso + codigo_dato
     */
    private construirIdProductoDato(
        productoDato: FedPatProductoDato
    ): string {

        return [
            productoDato.codigo_ramo,
            productoDato.numero_poliza,
            productoDato.certificado,
            productoDato.endoso,
            productoDato.codigo_dato
        ].join("_");
    }


    /**
     * Construye la clave natural de un riesgo cubierto.
     *
     * La combinación coincide con la utilizada durante la
     * acumulación del estado RAW:
     *
     * ramo + póliza + certificado + endoso +
     * ramo de cobertura + código de cobertura
     */
    private construirIdRiesgoCubierto(
        riesgoCubierto: FedPatRiesgoCubierto
    ): string {

        return [
            riesgoCubierto.codigo_ramo,
            riesgoCubierto.numero_poliza,
            riesgoCubierto.certificado,
            riesgoCubierto.endoso,
            riesgoCubierto.codigo_ramo_cobertura,
            riesgoCubierto.codigo_cobertura
        ].join("_");
    }


    /**
     * Construye la clave natural de un componente.
     *
     * La combinación coincide con la utilizada durante la
     * acumulación del estado RAW:
     *
     * ramo + póliza + certificado + endoso + codigo
     */
    private construirIdComponente(
        componente: FedPatCertificadoComponente
    ): string {

        return [
            componente.codigo_ramo,
            componente.numero_poliza,
            componente.certificado,
            componente.endoso,
            componente.codigo
        ].join("_");
    }


    /**
     * Prepara la metadata almacenada en el documento padre.
     *
     * Los arrays RAW no se incluyen en este documento.
     *
     * De esta forma el tamaño del padre permanece prácticamente
     * constante aunque la póliza acumule miles de movimientos.
     *
     * @param estado Estado técnico acumulado.
     * @returns Metadata preparada para Firestore.
     */
    private prepararMetadata(
        estado: FedPatPolizaState
    ): Record<string, unknown> {

        return this.eliminarUndefined<
            Record<string, unknown>
        >({
            codigoRamo:
                estado.codigoRamo,

            numeroPoliza:
                estado.numeroPoliza,

            ultimaFechaProcesada:
                estado.ultimaFechaProcesada
        });
    }


    /**
     * Prepara un registro RAW antes de persistirlo.
     *
     * Los modelos utilizados por FedPat son objetos planos con datos
     * provenientes de la API.
     *
     * Se eliminan propiedades undefined antes de enviarlas a
     * Firestore. Los valores null se conservan porque representan
     * explícitamente ausencia de información.
     *
     * @param registro Registro RAW.
     * @returns Documento preparado para Firestore.
     */
    private prepararRegistro(
        registro: object
    ): Record<string, unknown> {

        const copia:
            Record<string, unknown> = {
                ...registro
            };


        return this.eliminarUndefined(
            copia
        );
    }


    /**
     * Elimina recursivamente propiedades con valor undefined.
     *
     * Firestore no admite undefined de forma predeterminada.
     *
     * La limpieza se aplica tanto a objetos como a arrays anidados.
     * Los valores null se conservan.
     *
     * @param valor Valor que debe limpiarse.
     * @returns Nueva estructura sin valores undefined.
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
                        this.eliminarUndefined(
                            item
                        )
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