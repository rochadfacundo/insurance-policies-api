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

/**
 * Obtiene los bienes de un item de una póliza.
 *
 * @param poliza Número de póliza.
 * @param endoso Número de endoso.
 * @return Un MercantilBienesPoliza con los bienes del item de la póliza.
 * @throws Error si la consulta falla.
 */
export async function obtenerBienesPoliza(poliza: number, endoso: number): Promise<MercantilBienesPoliza> {

    const token = await obtenerTokenMA();

    try {

        const response = await axios.get<MercantilBienesPoliza>(
            `${BASE_URL}/polizas/v1/${poliza}/${endoso}/bienes`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY
                }
            }
        );

        return response.data;

    } catch (error) {

        console.error(
            `Error obteniendo bienes de la póliza ${poliza}, endoso ${endoso}`
        );

        if (axios.isAxiosError(error)) {

            console.error("Status:",error.response?.status);

            console.error("Respuesta de Mercantil:",JSON.stringify(
                    error.response?.data,
                    null,
                    2));

        } else {
            console.error(error);
        }

        throw error;
    }
}