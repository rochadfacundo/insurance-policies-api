import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";

dotenv.config({
    path: path.resolve(
        __dirname,
        "../../.env"
    )
});

const BASE_URL =
    process.env.MA_BASE_URL!;

const SUBSCRIPTION_KEY =
    process.env.MA_SUBSCRIPTION_KEY!;

/**
 * Obtiene el detalle completo de una póliza.
 *
 * Por ahora retorna any hasta conocer
 * exactamente la estructura del endpoint.
 */
export async function obtenerDetallePoliza(
    poliza: number,
    endoso: number
): Promise<any> {

    const token =
        await obtenerTokenMA();

    const response =
        await axios.get(
            `${BASE_URL}/polizas/v1/${poliza}/${endoso}`,
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