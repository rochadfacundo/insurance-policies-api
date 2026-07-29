import {
    Firestore,
    Timestamp,
    WriteBatch
} from "firebase-admin/firestore";

import { Poliza } from "../models/poliza";
import { FirebaseConfig } from "../config/firebaseConfig";
import { ECompania } from "../models/eCompania";
import { Productor } from "../models/productor";
import { FirestorePolizaEliminadaRepository } from "./firestorePolizaEliminadaRepository";
import { ResultadoSincronizacionRiesgos } from "../models/resultadoSincronizacionRiesgos";
import { MotivoEliminacionPoliza } from "../models/polizaEliminada";

export class FirestorePolizaRepository {

    private readonly COLLECTION_NAME = "polizas";
    private readonly BATCH_SIZE = 400;

    private readonly polizaEliminadaRepository: FirestorePolizaEliminadaRepository;

    private readonly firestore: Firestore;

    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
        this.polizaEliminadaRepository = new FirestorePolizaEliminadaRepository();
    }

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

    private prepararDocumento(poliza: Poliza, fechaCreacion: Timestamp,fechaActualizacion: Timestamp): Record<string, unknown> {
    
        return this.eliminarUndefined<Record<string, unknown>>({
            ...poliza,
            fechaCreacion,
            fechaActualizacion
        });
    }

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
    
    private convertirFecha(valor: Timestamp | Date | undefined): Date | undefined {
    
        if (valor instanceof Timestamp) {
            return valor.toDate();
        }
    
        return valor;
    }

    async obtenerPorId(id: string): Promise<Poliza | null> {
    
        const documento = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();
    
        if (!documento.exists) {
            return null;
        }
    
        return this.mapearDocumento(documento.id, documento.data()!);
    }

    async eliminar(id: string): Promise<void> {
    
        await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
    }

    async obtenerPorProductor(codigoProductor: number, compania?: ECompania): Promise<Poliza[]> {
    
        let consulta: FirebaseFirestore.Query = this.firestore.collection(this.COLLECTION_NAME)
                .where("productor.codigo", "==", codigoProductor);
    
        if (compania) {
            consulta = consulta.where("compania", "==", compania);
        }
    
        const resultado = await consulta.get();
    
        return resultado.docs.map(documento => this.mapearDocumento(documento.id, documento.data()));
    }

    async obtenerPorCompania(compania: ECompania): Promise<Poliza[]> {
    
        const resultado = await this.firestore.collection(this.COLLECTION_NAME).where("compania", "==", compania).get();
    
        return resultado.docs.map(documento => this.mapearDocumento(documento.id, documento.data()));
    }

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
    async sincronizarRiesgosProductor(productor: Productor, compania: ECompania, riesgosActuales: Poliza[]): Promise<ResultadoSincronizacionRiesgos> {

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

            this.polizaEliminadaRepository.agregarGuardadoDesdePolizaAlBatch(batch,riesgoEliminado,
                MotivoEliminacionPoliza.DEJO_DE_SER_RIESGO);

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
     * @param polizas    
     * @returns  
     */
    async sincronizarRiesgosIncrementales(polizas: Poliza[]): Promise<{
        riesgosActuales: number;
        riesgosNuevos: number;
        riesgosActualizados: number;
        riesgosEliminados: number;
    }> {
    
        if (polizas.length === 0) {
            return {
                riesgosActuales: 0,
                riesgosNuevos: 0,
                riesgosActualizados: 0,
                riesgosEliminados: 0
            };
        }
    
        const coleccion =
            this.firestore.collection(this.COLLECTION_NAME);
    
        let riesgosNuevos = 0;
        let riesgosActualizados = 0;
    
        for (
            let indice = 0;
            indice < polizas.length;
            indice += this.BATCH_SIZE
        ) {
            const lote = polizas.slice(
                indice,
                indice + this.BATCH_SIZE
            );
    
            const referencias = lote.map(poliza =>
                coleccion.doc(poliza.id)
            );
    
            const documentosExistentes =
                await this.firestore.getAll(...referencias);
    
            const batch = this.firestore.batch();
    
            for (
                let posicion = 0;
                posicion < lote.length;
                posicion++
            ) {
                const poliza = lote[posicion];
                const referencia = referencias[posicion];
                const documentoExistente =
                    documentosExistentes[posicion];
    
                if (
                    poliza === undefined ||
                    referencia === undefined ||
                    documentoExistente === undefined
                ) {
                    continue;
                }
    
                if (documentoExistente.exists) {
                    riesgosActualizados++;
                } else {
                    riesgosNuevos++;
                }
    
                batch.set(
                    referencia,
                    {
                        ...poliza,
                        fechaActualizacion: new Date()
                    },
                    {
                        merge: true
                    }
                );
            }
    
            await batch.commit();
        }
    
        return {
            riesgosActuales: polizas.length,
            riesgosNuevos,
            riesgosActualizados,
            riesgosEliminados: 0
        };
    }


}