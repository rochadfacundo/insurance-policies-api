import { MercantilBien, MercantilBienesPoliza } from "./mercantilBienesPoliza";

/**
 * Clase que maneja los bienes de una póliza de Mercantil.
 * Contiene métodos para acceder a los bienes asegurados y realizar
 * consultas sobre ellos.
 *
 * No contiene llamadas a la API.
 * La lógica de negocio sobre los bienes vive aquí.
 */
export class MercantilBienesPolizaManager {

    constructor(
        private readonly bienes: MercantilBienesPoliza
    ) {}

    /**
     * Devuelve el modelo original recibido desde la API.
     */
    getModel(): MercantilBienesPoliza {
        return this.bienes;
    }

    /**
     * Devuelve todos los bienes.
     */
    getBienes(): MercantilBien[] {
        return this.bienes.datos;
    }

    /**
     * Devuelve la cantidad de bienes asegurados.
     */
    getCantidadBienes(): number {
        return this.bienes.total;
    }

    /**
     * Indica si la póliza posee más de un bien.
     */
    esFlota(): boolean {
        return this.getCantidadBienes() > 1;
    }

    /**
     * Devuelve un bien por id.
     */
    getBien(id: number): MercantilBien | undefined {
        return this.bienes.datos.find(b => b.id === id);
    }

    /**
     * Devuelve la suma asegurada total.
     */
    getSumaAseguradaTotal(): number {
        return this.bienes.datos.reduce(
            (total, bien) => total + bien.suma,
            0
        );
    }

    /**
     * Devuelve el premio total de los bienes.
     */
    getPremioTotal(): number {
        return this.bienes.datos.reduce(
            (total, bien) => total + bien.premio,
            0
        );
    }

    /**
     * Devuelve la descripción de todos los bienes.
     */
    getDescripciones(): string[] {
        return this.bienes.datos.map(b => b.descripcion);
    }

    /**
     * Devuelve un resumen.
     */
    getResumen() {

        return {

            cantidadBienes: this.getCantidadBienes(),

            esFlota: this.esFlota(),

            sumaAsegurada: this.getSumaAseguradaTotal(),

            premio: this.getPremioTotal()

        };
    }

}