import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatProductor } from "../models/fedPatProductor";
import { FedPatProductoresResponse }
    from "../models/fedPatProductoresResponse";

/**
 * Servicio responsable de consultar los productores asociados
 * al organizador en la API de Cartera de Federación Patronal.
 *
 * La consulta se realiza a nivel organizador utilizando `tipo=O`,
 * por lo que una única petición permite obtener los productores
 * disponibles dentro de la cartera del organizador autenticado.
 */
export class FedPatProductoresService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene todos los productores asociados al organizador.
     *
     * El access token es administrado por FedPatAuthService,
     * permitiendo reutilizarlo mientras continúe vigente.
     *
     * @returns Lista de productores informados por Federación Patronal.
     */
    async obtenerProductores(): Promise<FedPatProductor[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatProductoresResponse>(
            `${this.baseUrl}/v1/cartera/productores`,
            {
                params: {
                    tipo: "O" // Consulta a nivel organizador
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data.productores;
    }
}