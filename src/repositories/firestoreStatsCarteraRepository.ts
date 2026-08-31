import {
    Firestore,
    Timestamp
} from "firebase-admin/firestore";

import {
    FirebaseConfig
} from "../config/firebaseConfig";

import {
    ECompania
} from "../models/eCompania";

import {
    StatsCartera
} from "../models/statsCartera";


export class FirestoreStatsCarteraRepository {

    private readonly COLLECTION_NAME = "statsCartera";

    private readonly firestore: Firestore;


    constructor() {
        this.firestore = FirebaseConfig.getFirestore();
    }


    /**
     * Guarda o actualiza la estadística de cartera
     * correspondiente a un productor y una compañía.
     *
     * Si el productor tiene matrícula, se utiliza:
     *
     * COMPANIA_MATRICULA
     *
     * Ejemplo:
     *
     * MERCANTIL_ANDINA_46984
     *
     * Si no tiene matrícula, se utiliza el nombre
     * normalizado como fallback.
     */
    async guardar(estadistica: StatsCartera): Promise<void> {

        const id =
            this.generarId(
                estadistica
            );


        const referencia =
            this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(id);


        const ahora =
            Timestamp.now();


        const datos = {
            ...estadistica,
            fechaActualizacion: ahora
        };


        await referencia.set(
            datos,
            {
                merge: true
            }
        );
    }


    /**
     * Obtiene la estadística de cartera
     * correspondiente a una matrícula
     * para una compañía.
     */
    async obtenerPorMatriculaYCompania(
        matricula: number,
        compania: ECompania
    ): Promise<StatsCartera | null> {

        const id =
            `${compania}_${matricula}`;


        const documento =
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(id)
                .get();


        if (!documento.exists) {
            return null;
        }


        return documento.data() as StatsCartera;
    }


    /**
     * Obtiene todas las estadísticas
     * correspondientes a una compañía.
     */
    async obtenerPorCompania(
        compania: ECompania
    ): Promise<StatsCartera[]> {

        const resultado =
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .where(
                    "compania",
                    "==",
                    compania
                )
                .get();


        return resultado.docs.map(
            documento =>
                documento.data() as StatsCartera
        );
    }


    /**
     * Genera el ID único de la estadística.
     */
    private generarId(estadistica: StatsCartera): string {

        if (estadistica.matricula !== null) {

            return `${estadistica.compania}_${estadistica.matricula}`;
        }


        const nombreNormalizado =this.normalizarNombre(estadistica.nombreProductor);


        return (
            `${estadistica.compania}_SIN_MATRICULA_` +
            `${nombreNormalizado}`
        );
    }


    /**
     * Normaliza el nombre para poder utilizarlo
     * como parte del ID de Firestore.
     */
    private normalizarNombre(
        nombre: string
    ): string {

        return nombre
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }
}