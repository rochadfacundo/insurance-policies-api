import axios from "axios";
import dotenv from "dotenv";

import { obtenerTokenMA } from "./login";
import { MercantilPolizasResponse } from "./models/mercantilModelPolizas";


dotenv.config();

// Configuración de la URL base y la clave de suscripción para la API de Mercantil Andina
const BASE_URL = process.env.MA_BASE_URL!;
const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;

/**
 * Obtiene las pólizas vigentes de un productor desde la API de Mercantil Andina. 
 * @param productor parametro que representa el ID del productor para el cual se desean obtener las pólizas vigentes.
 * @param limit límite de resultados a obtener en la consulta. Por defecto es 20. 
 * @param offset desplazamiento para la paginación de resultados. Por defecto es 0. 
 * @returns Una promesa que se resuelve con un objeto MercantilPolizasResponse que contiene las pólizas vigentes obtenidas. 
 */
export async function obtenerPolizasVigentes(productor: number,limit: number = 20,offset: number = 0)
: Promise<MercantilPolizasResponse> {

    const token = await obtenerTokenMA();

    const response = await axios.get<MercantilPolizasResponse>(
            `${BASE_URL}/cartera/v1/productores/${productor}/polizas/vigentes`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                    "Ocp-Apim-Subscription-Key":
                        SUBSCRIPTION_KEY
                },
                params: {
                    limit,
                    offset
                }
            }
        );

    return response.data;
}