import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";
import { MercantilDetallePoliza } from "../models/mercantilDetallePoliza";

dotenv.config({
    path: path.resolve(
        __dirname,
        "../../.env"
    )
});

// Configuración de la URL base y la clave de suscripción para la API de Mercantil Andina
const BASE_URL = process.env.MA_BASE_URL!;
const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;

/**
 * Obtiene el detalle completo de una póliza.
 * Incluye información de la póliza, endosos, bienes, coberturas, etc.
 * Si total o cantidad es mayor a 1, se considera flota.
 * No contiene lógica de negocio, solo delega la consulta a mercantilDetallePolizaService.
 * La lógica de negocio sobre el detalle de la póliza vive en MercantilDetallePolizaManager.
 * @param poliza Número de póliza.
 * @param endoso Número de endoso.
 * @return Un MercantilDetallePoliza con el detalle completo de la póliza.
 * @throws Error si la consulta falla.
 */
export async function obtenerDetallePoliza(poliza: number, endoso: number): Promise<MercantilDetallePoliza> {

    const token = await obtenerTokenMA();

    const response = await axios.get(`${BASE_URL}/polizas/v1/${poliza}/${endoso}`,
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