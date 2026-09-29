import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCliente } from "../models/fedPatCliente";
import { FedPatClientesResponse } from "../models/fedPatCarteraResponse";


/**
 * Servicio responsable de consultar los clientes informados
 * por la API de Cartera de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Los clientes pueden relacionarse posteriormente con los certificados
 * mediante los identificadores de asegurado informados por la API.
 *
 * Este servicio únicamente obtiene los datos y no realiza
 * transformaciones, deduplicaciones ni interpretación de la
 * información personal o fiscal del cliente.
 */
export class FedPatClientesService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
        
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los clientes informados por Federación Patronal
     * para una fecha determinada.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * Los registros se devuelven sin modificaciones para conservar
     * los valores originales, incluidos aquellos campos opcionales
     * que pueden ser informados como null.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Clientes correspondientes a la fecha solicitada.
     */
    async obtenerClientes(fecha: string): Promise<FedPatCliente[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatClientesResponse>(
            `${this.baseUrl}/v1/cartera/clientes`,
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

        return response.data.clientes;
    }
}