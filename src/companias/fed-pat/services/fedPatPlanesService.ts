import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatPlan } from "../models/fedPatPlan";

/**
 * Servicio responsable de consultar el catálogo de planes
 * definido por la API de Cartera de Federación Patronal.
 *
 * El endpoint `/cartera/prodplanes` devuelve los planes disponibles
 * asociados a sección y productor.
 *
 * Este servicio solamente transporta la información original
 * informada por Federación. La relación entre estos registros
 * y `codigo_plan` de los endosos se validará posteriormente
 * contra datos reales antes de utilizarla como regla de negocio.
 */
export class FedPatPlanesService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene el catálogo completo de planes
     * informado por Federación Patronal.
     *
     * El endpoint devuelve directamente un array de planes
     * y no requiere fecha ni tipo de productor.
     *
     * @returns Catálogo de planes de Federación Patronal.
     */
    async obtenerPlanes(): Promise<FedPatPlan[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatPlan[]>(
                `${this.baseUrl}/v1/cartera/prodplanes`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

        return response.data;
    }
}