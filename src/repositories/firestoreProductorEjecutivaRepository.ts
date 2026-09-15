import { FieldValue, Firestore } from "firebase-admin/firestore";

import { FirebaseConfig } from "../config/firebaseConfig";

import { ProductorEjecutiva } from "../models/productorEjecutiva";
import { ECompania } from "../models/eCompania";


/**
 * Repository encargado del acceso a la colección
 * "productoresEjecutivas" de Firestore.
 *
 * Esta colección almacena la relación entre:
 *
 * - una compañía;
 * - un productor dentro de dicha compañía;
 * - la ejecutiva responsable del productor.
 *
 * La ejecutiva no se almacena completa dentro de la relación.
 * Solamente se guarda su identificador mediante "ejecutivaId".
 *
 * Los datos completos de la ejecutiva se encuentran
 * almacenados en la colección "ejecutivas".
 *
 * La identificación de cada relación se realiza mediante
 * la combinación:
 *
 *      compañía + código del productor
 *
 * Ejemplo:
 *
 *      RIO_URUGUAY_4666
 *      MERCANTIL_ANDINA_97521
 *
 * Esto evita colisiones entre códigos de productor
 * pertenecientes a compañías diferentes.
 */
export class FirestoreProductorEjecutivaRepository {

    /**
     * Nombre de la colección donde se almacenan
     * las relaciones entre productores y ejecutivas.
     */
    private readonly COLLECTION_NAME = "productoresEjecutivas";

    /**
     * Instancia de Firestore utilizada para realizar
     * las operaciones sobre la colección.
     */
    private readonly firestore: Firestore;

    /**
     * Inicializa el repository y obtiene
     * la instancia de Firestore.
     */
    constructor() {

        this.firestore = FirebaseConfig.getFirestore();
    }


    /**
     * Guarda o actualiza la relación entre un productor
     * y una ejecutiva.
     *
     * El ID del documento se construye utilizando:
     *
     *      compañía + código del productor
     *
     * Si la relación todavía no existe, se establece
     * automáticamente su fecha de creación.
     *
     * La fecha de actualización se modifica en cada
     * operación de guardado.
     *
     * @param productorEjecutiva relación entre compañía,
     * productor y ejecutiva que se desea guardar.
     */
    async guardar(productorEjecutiva: ProductorEjecutiva): Promise<void> {

        const id = `${productorEjecutiva.compania}_` + `${productorEjecutiva.productor.codigo}`;

        const referencia = this.firestore.collection(this.COLLECTION_NAME).doc(id);

        const documento = await referencia.get();


        /*
        * Datos que siempre se actualizan.
        */
        const datos: Record<string, unknown> = {
            ...productorEjecutiva,
            fechaActualizacion: FieldValue.serverTimestamp()
        };


        /*
        * La fecha de creación solamente se establece
        * cuando la relación todavía no existe.
        */
        if (!documento.exists) {
            datos.fechaCreacion = FieldValue.serverTimestamp();
        }


        await referencia.set(datos,
            {
                merge: true
            }
        );
    }


    /**
     * Obtiene la relación productor-ejecutiva correspondiente
     * a un productor dentro de una compañía determinada.
     *
     * La búsqueda utiliza directamente el ID compuesto
     * del documento:
     *
     *      compania_codigoProductor
     *
     * Ejemplo:
     *
     *      MERCANTIL_ANDINA_97521
     *
     * @param compania compañía a la que pertenece
     * el código del productor.
     *
     * @param codigoProductor código interno utilizado
     * por la compañía para identificar al productor.
     *
     * @returns relación encontrada o null si no existe.
     *
     * @see ProductorEjecutiva
     * @see ECompania
     */
    async obtenerPorCodigoProductor(compania: ECompania, codigoProductor: number): Promise<ProductorEjecutiva | null> {

        const id = `${compania}_${codigoProductor}`;

        const documento = await this.firestore.collection(this.COLLECTION_NAME).doc(id).get();

        if (!documento.exists)
        return null;
        

        const datos = documento.data();

        if (!datos)
        return null;

        return datos as ProductorEjecutiva;
    }


    /**
     * Obtiene todas las relaciones entre productores
     * y ejecutivas configuradas en Firestore.
     *
     * Este método no realiza ningún filtro por compañía
     * ni por ejecutiva.
     *
     * Es utilizado, por ejemplo, por el proceso de
     * renovaciones para cargar las relaciones una sola vez
     * y posteriormente indexarlas en memoria.
     *
     * @returns listado completo de relaciones
     * productor-ejecutiva.
     *
     * @see ProductorEjecutiva
     */
    async obtenerTodos(): Promise<ProductorEjecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME).get();

        return resultado.docs.map(documento => documento.data() as ProductorEjecutiva);
    }


    /**
     * Obtiene todas las relaciones asociadas
     * a una ejecutiva determinada.
     *
     * La búsqueda se realiza mediante el campo "ejecutivaId",
     * que referencia al documento correspondiente dentro
     * de la colección "ejecutivas".
     *
     * Este método puede utilizarse, por ejemplo, para
     * consultar todos los productores que se encuentran
     * actualmente asignados a una ejecutiva.
     *
     * @param idEjecutiva identificador de la ejecutiva.
     *
     * @returns listado de relaciones correspondientes
     * a la ejecutiva indicada.
     *
     * @see ProductorEjecutiva
     */
    async obtenerPorEjecutiva(idEjecutiva: string): Promise<ProductorEjecutiva[]> {

        const resultado = await this.firestore.collection(this.COLLECTION_NAME)
                .where("ejecutivaId","==",idEjecutiva).get();

        return resultado.docs.map(documento => documento.data() as ProductorEjecutiva);
    }


    /**
     * Elimina la relación entre un productor
     * y una ejecutiva dentro de una compañía.
     *
     * La eliminación afecta únicamente al documento
     * almacenado en "productoresEjecutivas".
     *
     * No elimina:
     *
     * - al productor;
     * - a la ejecutiva;
     * - las pólizas relacionadas.
     *
     * El documento se identifica mediante:
     *
     *      compania_codigoProductor
     *
     * @param compania compañía a la que pertenece
     * el productor.
     *
     * @param codigoProductor código interno utilizado
     * por la compañía para identificar al productor.
     *
     * @see ProductorEjecutiva
     * @see ECompania
     */
    async eliminar(compania: ECompania, codigoProductor: number): Promise<void> {

        const id =`${compania}_${codigoProductor}`;

        await this.firestore.collection(this.COLLECTION_NAME).doc(id).delete();
    }
}