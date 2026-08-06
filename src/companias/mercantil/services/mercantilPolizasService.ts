import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";

import {MercantilPolizasResponse} from "../models/mercantilModelPolizas";

dotenv.config({path: path.resolve(__dirname,"../../.env")});

const BASE_URL = process.env.MA_BASE_URL!;

const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;

/*
    * Obtiene las pólizas vigentes de un productor.
    * Se pueden paginar los resultados con limit y offset.
    * Si limit o offset no se especifican, se obtienen los primeros 20 resultados.
    * Si el productor no tiene pólizas vigentes, se devuelve un array vacío.
    * Si el productor no existe, se devuelve un error.
    * Si el token no es válido, se devuelve un error.
    * Si la suscripción no es válida, se devuelve un error.
    * Si ocurre cualquier otro error, se devuelve un error genérico.
    * La respuesta incluye un array de pólizas, cada una con su información detallada.
    * Cada póliza incluye su número, endoso, tipo, fecha de inicio, fecha de fin, estado, etc.
    * La lógica de negocio sobre las pólizas vive en MercantilPolizasManager, este servicio solo se encarga de obtener los datos de la API.
    * @see MercantilPolizasManager
    * @see mercantilPolizasManager.obtenerCarteraCompleta para obtener toda la cartera de un productor sin preocuparse por la paginación.
    * @throws Error si la consulta falla por cualquier motivo.
    * @param productor Número de productor.
    * @param limit Número máximo de resultados a devolver. Por defecto 20.
    * @param offset Número de resultados a omitir. Por defecto 0.
    * @return Un objeto con la información de las pólizas vigentes del productor, incluyendo paginación.
    * @see mercantilPolizasManager.obtenerCarteraCompleta para obtener toda la cartera de un productor sin preocuparse por la paginación.
*/
/**
 * Obtiene las pólizas vigentes de un productor desde la API de Mercantil Andina. 
 * @param productor parametro que representa el ID del productor para el cual se desean obtener las pólizas vigentes. 
 * @param limit límite de resultados a obtener en la consulta. Por defecto es 20. 
 * @param offset desplazamiento para la paginación de resultados. Por defecto es 0. 
 * @returns Una promesa que se resuelve con un objeto MercantilPolizasResponse que contiene las pólizas vigentes obtenidas.
 * @see mercantilPolizasManager.obtenerCarteraCompleta para obtener toda la cartera de un productor sin preocuparse por la paginación. 
 */
export async function obtenerPolizasVigentes(productor: number,limit: number = 20,offset: number = 0)
: Promise<MercantilPolizasResponse> {

    const token = await obtenerTokenMA();

    const response =  await axios.get<MercantilPolizasResponse>(
            `${BASE_URL}/cartera/v1/productores/${productor}/polizas/vigentes`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,

                    "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY
                },

                params: { limit, offset }
            }
        );

    return response.data;
}