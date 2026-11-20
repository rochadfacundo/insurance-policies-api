
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";
import { MercantilDetallePoliza } from "../models/mercantilDetallePoliza";

dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});

/**
 * Obtiene el detalle completo de una póliza de Mercantil Andina.
 */
export async function obtenerDetallePoliza(
    poliza: number,
    endoso: number
): Promise<MercantilDetallePoliza> {

    // Leemos las variables al ejecutar la función.
    const baseUrl = process.env.MA_BASE_URL;
    const subscriptionKey = process.env.MA_SUBSCRIPTION_KEY;

    // Verificamos que estén configuradas.
    if (!baseUrl || !subscriptionKey) {
        throw new Error("Falta configurar MA_BASE_URL o MA_SUBSCRIPTION_KEY");
    }

    // Construimos la URL.
    const url = `${baseUrl}/polizas/v1/${poliza}/${endoso}`;

    // Obtenemos el token.
    const token = await obtenerTokenMA();

    // Consultamos el detalle de la póliza.
    const response = await axios.get<MercantilDetallePoliza>(
        url,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Ocp-Apim-Subscription-Key": subscriptionKey
            }
        }
    );

    return response.data;
}
