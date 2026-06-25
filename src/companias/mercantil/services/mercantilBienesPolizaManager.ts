// models/mercantilBienesPolizaManager.ts

import { MercantilBien, MercantilBienesPoliza } from "../models/mercantilBienesPoliza";

/*
    * Clase que maneja la lógica de negocio sobre los bienes de una póliza.
    * Recibe un MercantilBienesPoliza y expone métodos para obtener información sobre los bienes.
    * No contiene lógica de consulta, solo lógica de negocio sobre los bienes.
    * @see MercantilBienesPoliza
*/
export class MercantilBienesPolizaManager {

    constructor(private readonly bienes: MercantilBienesPoliza) {}

    /*
        * Obtiene la cantidad total de bienes de la póliza.
         * Si total o cantidad es mayor a 1, se considera flota.
         * No contiene lógica de negocio, solo delega la consulta a mercantilBienesService.
         * La lógica de negocio sobre los bienes vive en MercantilBienesPolizaManager.
         * @return La cantidad total de bienes de la póliza.
    */
    getCantidadBienes(): number {

        return this.bienes.total;
    }


    /*
        * Obtiene el valor total asegurado de la póliza.
        * Si total o cantidad es mayor a 1, se considera flota.
        * No contiene lógica de negocio, solo delega la consulta a mercantilBienesService.
        * La lógica de negocio sobre los bienes vive en MercantilBienesPolizaManager.
        * @return El valor total asegurado de la póliza.
    */
    getBienes(): MercantilBien[] {
        return this.bienes.datos;
    }
}