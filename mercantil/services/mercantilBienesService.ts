import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";
import { MercantilBienesPoliza } from "../models/mercantilBienesPoliza";

dotenv.config({
    path: path.resolve(
        __dirname,
        "../../.env"
    )
});

const BASE_URL = process.env.MA_BASE_URL!;

const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;
/*
    * Obtiene los bienes de un item de una póliza.
    * Si total o cantidad es mayor a 1, se considera flota.
    * No contiene lógica de negocio, solo delega la consulta a mercantilBienesService.
    * La lógica de negocio sobre los bienes vive en MercantilBienesPolizaManager.
    * @param poliza Número de póliza.
    * @param endoso Número de endoso.
    * @return Un MercantilBienesPoliza con los bienes del item de la póliza.
    * @throws Error si la consulta falla.
    * @see MercantilBienesPolizaManager
    * @see mercantilBienesService.obtenerBienesPoliza
*/
export async function obtenerBienesPoliza(poliza: number,endoso: number): Promise<MercantilBienesPoliza> {

    const token =
        await obtenerTokenMA();

    const response =
        await axios.get(
            `${BASE_URL}/polizas/v1/${poliza}/${endoso}/bienes`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,

                    "Ocp-Apim-Subscription-Key":
                        SUBSCRIPTION_KEY
                }
            }
        );

    return response.data;
}