import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatRamoPoliza } from "../models/fedPatRamoPoliza";

/**
 * Servicio responsable de consultar el catálogo de ramos
 * de pólizas de la API de Cartera de Federación Patronal.
 *
 * El catálogo permite identificar el ramo correspondiente a los
 * códigos utilizados en certificados, endosos y demás entidades
 * de la cartera.
 *
 * A diferencia de los endpoints operativos, esta consulta no
 * requiere fecha ni tipo de productor y devuelve directamente
 * una colección de ramos.
 */
export class FedPatRamosPolizasService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
      
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene el catálogo completo de ramos de pólizas
     * definido por Federación Patronal.
     *
     * Los registros se devuelven sin transformaciones para
     * conservar los códigos originales utilizados por la API.
     *
     * @returns Catálogo de ramos de pólizas.
     */
    async obtenerRamosPolizas(): Promise<FedPatRamoPoliza[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatRamoPoliza[]>(
            `${this.baseUrl}/v1/cartera/ramos-polizas`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data;
    }
}