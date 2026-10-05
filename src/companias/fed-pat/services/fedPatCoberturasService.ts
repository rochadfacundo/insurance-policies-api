import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCobertura } from "../models/fedPatCobertura";

/**
 * Servicio responsable de consultar el catálogo de coberturas
 * definido por la API de Cartera de Federación Patronal.
 *
 * El endpoint `/cartera/coberturas` devuelve el catálogo general
 * de coberturas y no requiere una fecha de consulta.
 *
 * Este servicio se limita a transportar la información original
 * informada por Federación. La relación entre estas coberturas y
 * los registros de `riesgos-cubiertos` se resolverá posteriormente
 * en una capa de dominio específica.
 */
export class FedPatCoberturasService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene el catálogo completo de coberturas
     * de Federación Patronal.
     *
     * El endpoint devuelve directamente un array de coberturas,
     * por lo que no es necesario utilizar un modelo de respuesta
     * intermedio.
     *
     * @returns Catálogo de coberturas informado por Federación Patronal.
     */
    async obtenerCoberturas(): Promise<FedPatCobertura[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatCobertura[]>(
                `${this.baseUrl}/v1/cartera/coberturas`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

        return response.data;
    }
}