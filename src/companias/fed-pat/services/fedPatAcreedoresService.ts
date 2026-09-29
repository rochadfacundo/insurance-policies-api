import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatAcreedor } from "../models/fedPatAcreedor";
import { FedPatAcreedoresResponse } from "../models/fedPatAcreedoresResponse";

/**
 * Servicio responsable de consultar los acreedores informados
 * por la API de Cartera de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Los acreedores pueden relacionarse con los certificados mediante
 * el campo `codigo_acreedor`.
 *
 * Este servicio únicamente obtiene la información original de la API
 * y no interpreta el tipo de acreedor ni modifica sus datos.
 */
export class FedPatAcreedoresService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
      
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los acreedores informados por Federación Patronal
     * para una fecha determinada.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * Los registros se devuelven sin transformaciones para conservar
     * los valores originales y sus posibles campos nulos.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Acreedores correspondientes a la fecha solicitada.
     */
    async obtenerAcreedores(fecha: string): Promise<FedPatAcreedor[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatAcreedoresResponse>(
            `${this.baseUrl}/v1/cartera/acreedores`,
            {
                params: {
                    fecha,
                    tipo: "O"
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data.acreedores;
    }
}