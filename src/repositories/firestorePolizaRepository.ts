import {
    Firestore,
    Timestamp,
    WriteBatch
} from "firebase-admin/firestore";

import { Poliza } from "../models/poliza";
import { FirebaseConfig } from "../config/firebaseConfig";
import { ECompania } from "../models/eCompania";
import { Productor, ProductorBase } from "../models/productor";
import { FirestorePolizaEliminadaRepository } from "./firestorePolizaEliminadaRepository";
import { ResultadoSincronizacionRiesgos } from "../models/resultadoSincronizacionRiesgos";
import { MotivoEliminacionPoliza } from "../models/polizaEliminada";
import { machineLearning } from "firebase-admin";

export class FirestorePolizaRepository {

    /**
     * Atributos privados de la clase FirestorePolizaRepository.
     * Colección de Firestore donde se almacenan las pólizas y la instancia de Firestore.
     * COLLECTION_NAME: Nombre de la colección de Firestore donde se almacenan las pólizas.
     * BATCH_SIZE: Tamaño del lote para operaciones de escritura en Firestore.
     * polizaEliminadaRepository: Instancia de FirestorePolizaEliminadaRepository para manejar pólizas eliminadas.
     * firestore: Instancia de Firestore utilizada para interactuar con la base de datos.
     */
    private readonly COLLECTION_NAME = "polizas";
    private readonly BATCH_SIZE = 400;
    private readonly polizaEliminadaRepository: FirestorePolizaEliminadaRepository;
    private readonly firestore: Firestore;

    /**
     * Crea una instancia de FirestorePolizaRepository y establece la conexión con Firestore. 
     */
    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
        this.polizaEliminadaRepository = new FirestorePolizaEliminadaRepository();
    }

    /**
     * Guarda o actualiza una póliza en Firestore. 
     * @param poliza póliza que se desea guardar o actualizar en Firestore.
     * @returns una promesa que se resuelve cuando la póliza ha sido guardada o actualizada en Firestore. 
     */
    async guardar(poliza: Poliza): Promise<void> {

        const referencia = this.firestore
            .collection(this.COLLECTION_NAME)
            .doc(poliza.id);

        const documentoActual = await referencia.get();
        const ahora = Timestamp.now();

        const fechaCreacion =
            documentoActual.exists
                ? documentoActual.get("fechaCreacion")
                : ahora;

        const datos = this.prepararDocumento(
            poliza,
            fechaCreacion,
            ahora
        );

        await referencia.set(datos);
    }

    /**
     * Guarda o actualiza varias pólizas en Firestore en lotes. 
     * @param polizas arreglo de pólizas que se desean guardar o actualizar en Firestore. 
     * @returns una promesa que se resuelve cuando todas las pólizas han sido guardadas o actualizadas en Firestore. 
     */
    async guardarMuchas(polizas: Poliza[]): Promise<void> {

        if (polizas.length === 0) {
            return;
        }

        for (
            let indice = 0;
            indice < polizas.length;
            indice += this.BATCH_SIZE
        ) {

            const lote = polizas.slice(
                indice,
                indice + this.BATCH_SIZE
            );

            await this.guardarLote(lote);
        }
    }

    /**
     * Guarda o actualiza un lote de pólizas en Firestore utilizando una operación de escritura por lotes. 
     * @param polizas arreglo de pólizas que se desean guardar o actualizar en Firestore.
     * @returns una promesa que se resuelve cuando todas las pólizas del lote han sido guardadas o actualizadas en Firestore. 
     */
    private async guardarLote(polizas: Poliza[]): Promise<void> {
    
        const referencias = polizas.map(poliza => this.firestore.collection(this.COLLECTION_NAME).doc(poliza.id));
    
        const documentosActuales = await this.firestore.getAll(...referencias);
    
        const batch: WriteBatch = this.firestore.batch();
    
        const ahora = Timestamp.now();
    
        for (let indice = 0; indice < polizas.length; indice++) {
    
            const poliza = polizas[indice];
            const referencia = referencias[indice];
            const documentoActual = documentosActuales[indice];
    
            if (!poliza || !referencia || !documentoActual) {
                throw new Error(`No se pudo preparar la póliza del índice ${indice}`);
            }
    
            const fechaCreacion = documentoActual.exists
                    ? documentoActual.get("fechaCreacion") ?? ahora
                    : ahora;
    
            const datos = this.prepararDocumento(poliza, fechaCreacion, ahora);
    
            batch.set(referencia, datos);
        }
    
        await batch.commit();
    }

    /**
     * Prepara un objeto Poliza para ser guardado en Firestore, eliminando los campos undefined y agregando las fechas de creación y actualización. 
     * @param poliza póliza que se desea preparar para ser guardada en Firestore. 
     * @param fechaCreacion fecha de creación de la póliza, que se utiliza si la póliza ya existe en Firestore.      
     * @param fechaActualizacion fecha de actualización de la póliza, que se establece en el momento de guardar o actualizar
     *  la póliza en Firestore. 
     * @returns un objeto que contiene los datos de la póliza listos para ser guardados en Firestore. 
     */
    private prepararDocumento(poliza: Poliza, fechaCreacion: Timestamp,fechaActualizacion: Timestamp): Record<string, unknown> {
    
        return this.eliminarUndefined<Record<string, unknown>>({
            ...poliza,
            fechaCreacion,
            fechaActualizacion
        });
    }

    /**
     * Mapea un documento de Firestore a un objeto Poliza, convirtiendo las fechas de Timestamp a Date. 
     * @param id identificador del documento de Firestore que se está mapeando. 
     * @param datos datos del documento de Firestore que se están mapeando a un objeto Poliza. 
     * @returns un objeto Poliza que contiene los datos del documento de Firestore mapeados y las fechas convertidas a Date.      
     */
    private mapearDocumento(id: string,datos: FirebaseFirestore.DocumentData): Poliza {
    
        return {
            ...datos,
    
            id,
    
            facturacion: {
                ...datos["facturacion"],
                desde: this.convertirFecha(
                    datos["facturacion"]?.desde
                ),
                hasta: this.convertirFecha(
                    datos["facturacion"]?.hasta
                )
            },
    
            vigencia: {
                ...datos["vigencia"],
                desde: this.convertirFecha(
                    datos["vigencia"]?.desde
                ),
                hasta: this.convertirFecha(
                    datos["vigencia"]?.hasta
                )
            },
    
            fechaCreacion: this.convertirFecha(
                datos["fechaCreacion"]
            ),
    
            fechaActualizacion: this.convertirFecha(
                datos["fechaActualizacion"]
            )
    
        } as Poliza;
    }
    
    /**
     * Convierte un valor de tipo Timestamp o Date a Date, o devuelve undefined si el valor es undefined. 
     * @param valor valor de tipo Timestamp, Date o undefined que se desea convertir a Date. 
     * @returns un objeto Date si el valor es de tipo Timestamp o Date, o undefined si el valor es undefined. 
     */
    private convertirFecha(valor: Timestamp | Date | undefined): Date | undefined {
    
        if (valor instanceof Timestamp) {
            return valor.toDate();
        }
    
        return valor;
    }

    /**
     * Obtiene una póliza de Firestore por su ID. 
     * @param id identificador de la póliza que se desea obtener. 
     * @returns retorna una promesa que se resuelve con un objeto Poliza si se encuentra la póliza, o null si no se encuentra. 
     */
    async obtenerPorId(id: string): Promise<Poliza | null> {
    
        const documento = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();
    
        if (!documento.exists) {
            return null;
        }
    
        return this.mapearDocumento(documento.id, documento.data()!);
    }

    /**
     * Elimina una póliza de Firestore por su ID. 
     * @param id identificador de la póliza que se desea eliminar.
     * @returns retorna una promesa que se resuelve cuando la póliza ha sido eliminada de Firestore. 
     */
    async eliminar(id: string): Promise<void> {
    
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
    }

    /**
     * Obtiene todas las pólizas de un productor específico, opcionalmente filtradas por compañía. 
     * @param codigoProductor código del productor para el cual se desean obtener las pólizas. 
     * @param compania opcionalmente, compañía por la cual se desea filtrar las pólizas. 
     * @returns retorna una promesa que se resuelve con un arreglo de objetos Poliza que pertenecen al productor y, 
     * si se especifica, a la compañía indicada. 
     */
    async obtenerPorProductor(codigoProductor: number, compania?: ECompania): Promise<Poliza[]> {
    
        let consulta: FirebaseFirestore.Query = this.firestore.collection(this.COLLECTION_NAME)
                .where("productor.codigo", "==", codigoProductor);
    
        if (compania) {
            consulta = consulta.where("compania", "==", compania);
        }
    
        const resultado = await consulta.get();
    
        return resultado.docs.map(documento => this.mapearDocumento(documento.id, documento.data()));
    }

    /**
     * Obtiene todas las pólizas de una compañía específica. 
     * @param compania compañía por la cual se desea filtrar las pólizas. 
     * @returns retorna una promesa que se resuelve con un arreglo de objetos Poliza que pertenecen a la compañía indicada. 
     */
    async obtenerPorCompania(compania: ECompania): Promise<Poliza[]> {
    
        const resultado = await this.firestore.collection(this.COLLECTION_NAME).where("compania", "==", compania).get();
    
        return resultado.docs.map(documento => this.mapearDocumento(documento.id, documento.data()));
    }

    /**
     * Elimina recursivamente los campos undefined de un objeto o arreglo, devolviendo una nueva instancia sin esos campos. 
     * @param valor objeto o arreglo del cual se desean eliminar los campos undefined. 
     * @returns una nueva instancia del objeto o arreglo sin los campos undefined. 
     */
    private eliminarUndefined<T>(
        valor: T
    ): T {
    
        if (Array.isArray(valor)) {

            return valor.filter(item => item !== undefined).map(item => this.eliminarUndefined(item)) as T;
        }
    
        if (
            valor !== null &&
            typeof valor === "object" &&
            !(valor instanceof Date) &&
            !(valor instanceof Timestamp)
        ) {
    
            return Object.fromEntries(
                Object.entries(valor)
                    .filter(([, contenido]) =>
                        contenido !== undefined
                    )
                    .map(([clave, contenido]) => [
                        clave,
                        this.eliminarUndefined(contenido)
                    ])
            ) as T;
        }
    
        return valor;
    }

    /*
    Obtiene los riesgos guardados del productor.
    Guarda o actualiza los riesgos actuales.
    Detecta cuáles ya no aparecen.
    Los mueve a polizasEliminadas.
    Elimina de polizas los que dejaron de ser riesgo.
    */
   /**
    * Sincroniza los riesgos de un productor específico, comparando los riesgos actuales con los riesgos guardados en Firestore. 
    * @param productor productor para el cual se desea sincronizar los riesgos.   
    * @param compania compañía por la cual se desea filtrar los riesgos.
    * @param riesgosActuales riesgos actuales que se desean sincronizar con los riesgos guardados en Firestore.
    * @returns retorna una promesa que se resuelve con un objeto ResultadoSincronizacionRiesgos que contiene
    *  información sobre la cantidad de riesgos actuales, nuevos, actualizados y eliminados durante la sincronización. 
    */
    async sincronizarRiesgosProductor(productor: ProductorBase, compania: ECompania, riesgosActuales: Poliza[]): Promise<ResultadoSincronizacionRiesgos> {

        const riesgosGuardados = await this.obtenerPorProductor(productor.codigo, compania);

        const idsGuardados = new Set(riesgosGuardados.map(poliza => poliza.id));

        const idsActuales = new Set(riesgosActuales.map(poliza => poliza.id));

        let riesgosNuevos = 0;
        let riesgosActualizados = 0;

        const riesgosQueYaNoExisten = riesgosGuardados.filter(poliza => !idsActuales.has(poliza.id));

        const batch = this.firestore.batch();

        const ahora = Timestamp.now();

        const referenciasActuales = riesgosActuales.map(riesgo => this.firestore.collection(this.COLLECTION_NAME).doc(riesgo.id));

        const documentosActuales = referenciasActuales.length > 0
                ? await this.firestore.getAll(...referenciasActuales)
                : [];

        /*
        * Inserta o actualiza los riesgos actuales.
        */
        for (let indice = 0; indice < riesgosActuales.length; indice++) {
        
            const riesgoActual = riesgosActuales[indice];
        
            const referenciaPoliza = referenciasActuales[indice];
        
            const documentoActual = documentosActuales[indice];
        
            if (!riesgoActual || !referenciaPoliza || !documentoActual) {
                throw new Error(`No se pudo preparar el riesgo del índice ${indice}`);
            }
        
            if (idsGuardados.has(riesgoActual.id)) {     
                riesgosActualizados++;
            } else {
        
                riesgosNuevos++;     
                this.polizaEliminadaRepository.agregarEliminacionAlBatch(batch, riesgoActual.id);
            }
        
            const fechaCreacion = documentoActual.exists
                    ? documentoActual.get("fechaCreacion") ?? ahora
                    : ahora;
        
            const datos = this.prepararDocumento(riesgoActual,fechaCreacion,ahora);
        
            batch.set(referenciaPoliza,datos);
        }

        /*
        * Mueve a polizasEliminadas los riesgos
        * que ya no fueron detectados.
        */
        for (const riesgoEliminado of riesgosQueYaNoExisten) {

            const motivo = MotivoEliminacionPoliza.DEJO_DE_SER_RIESGO;

            this.polizaEliminadaRepository.agregarGuardadoDesdePolizaAlBatch(batch,riesgoEliminado,motivo);

            const referenciaPoliza = this.firestore.collection(this.COLLECTION_NAME).doc(riesgoEliminado.id);

            batch.delete(referenciaPoliza);
        }

        await batch.commit();

        return {
            riesgosActuales: riesgosActuales.length,
            riesgosNuevos,
            riesgosActualizados,
            riesgosEliminados: riesgosQueYaNoExisten.length
        };
    }


    /**
     *  Sincroniza los riesgos incrementales de un productor.
     * @param productor productor para el cual se desea sincronizar los riesgos incrementales.
     * @param compania compañía por la cual se desea filtrar los riesgos.
     * @param polizas arreglo de pólizas que representan los riesgos incrementales que se desean sincronizar
     *  con los riesgos guardados en Firestore. 
     * @returns  retorna una promesa que se resuelve con un objeto que contiene información sobre la cantidad de riesgos
     *  actuales, nuevos, actualizados y eliminados durante la sincronización. 
     * @see ResultadoSincronizacionRiesgos para la estructura del objeto de resultado de la sincronización de riesgos.
     * @see ProductorBase para la estructura del productor.
     * @see ECompania para la estructura de la compañía.
     * @see Poliza para la estructura de la póliza.
     */
    async sincronizarRiesgosIncrementales(productor: ProductorBase, compania: ECompania, polizas: Poliza[])
    : Promise<ResultadoSincronizacionRiesgos> 
    {
    
        const riesgosGuardados = await this.obtenerPorProductor(productor.codigo, compania);
        
        const idsEntrantes = new Set(polizas.map(poliza => poliza.id));
        
        const ahora = new Date();
        
        const riesgosVencidos = riesgosGuardados.filter(poliza => {

            const fechaHasta = poliza.vigencia?.hasta;
        
            if (!(fechaHasta instanceof Date)) {
                return false;
            }
        
            const finDelDia = new Date(fechaHasta);
        
            finDelDia.setHours(23, 59, 59, 999);
        
            return (finDelDia.getTime() < ahora.getTime() && !idsEntrantes.has(poliza.id));
        });
    
        const coleccion = this.firestore.collection(this.COLLECTION_NAME);
    
        let riesgosNuevos = 0;
        let riesgosActualizados = 0;
    
        const ahoraTimestamp = Timestamp.now();

        for (let indice = 0; indice < polizas.length; indice += this.BATCH_SIZE) {
            const lote = polizas.slice(indice, indice + this.BATCH_SIZE);
    
            const referencias = lote.map(poliza => coleccion.doc(poliza.id));
    
            const documentosExistentes = await this.firestore.getAll(...referencias);
    
            const batch = this.firestore.batch();
    
            for (let posicion = 0; posicion < lote.length; posicion++) {
                const poliza = lote[posicion];
                const referencia = referencias[posicion];
                const documentoExistente = documentosExistentes[posicion];
    
                if ( poliza === undefined ||referencia === undefined || documentoExistente === undefined) {
                    continue;
                }
    
                if (documentoExistente.exists) {
                    riesgosActualizados++;
                } else {
                    riesgosNuevos++;

                    this.polizaEliminadaRepository.agregarEliminacionAlBatch(batch, poliza.id);
                }

                const fechaCreacion = documentoExistente.exists
                    ? documentoExistente.get("fechaCreacion") ?? ahoraTimestamp
                    : ahoraTimestamp;

                const datos = this.prepararDocumento(poliza, fechaCreacion,ahoraTimestamp);
    
                batch.set(referencia, datos);
            }
    
            await batch.commit();
        }

        const BATCH_SIZE_ELIMINACIONES = 200;

        for (let indice = 0; indice < riesgosVencidos.length;indice += BATCH_SIZE_ELIMINACIONES) {
        
            const lote = riesgosVencidos.slice(indice, indice + BATCH_SIZE_ELIMINACIONES);
        
            const batch = this.firestore.batch();
        
            for (const riesgoVencido of lote) {

                const motivo = MotivoEliminacionPoliza.DEJO_DE_SER_RIESGO;
        
                this.polizaEliminadaRepository.agregarGuardadoDesdePolizaAlBatch(batch, riesgoVencido ,motivo);
        
                const referencia = coleccion.doc(riesgoVencido.id);
        
                batch.delete(referencia);
            }
        
            await batch.commit();
        }

    
        return {
            riesgosActuales: polizas.length,
            riesgosNuevos,
            riesgosActualizados,
            riesgosEliminados: riesgosVencidos.length
        };
    }


}