import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";
import { FedPatCertificadosSumasResponse } from "../models/fedPatCertificadosSumasResponse";

/**
 * Servicio responsable de consultar las sumas y valores económicos
 * asociados a los certificados informados por la API de Cartera
 * de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Cada registro puede relacionarse con un certificado mediante
 * `codigo_ramo`, `numero_poliza` y `certificado`.
 *
 * Este servicio conserva los valores económicos tal como son
 * informados por Federación Patronal. La interpretación de prima,
 * premio y suma asegurada se realizará posteriormente en las capas
 * de mapeo y lógica de negocio.
 */
export class FedPatCertificadosSumasService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {

        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";

    }

    /**
     * Obtiene las sumas asociadas a los certificados informados
     * por Federación Patronal para una fecha determinada.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * No se realizan cálculos ni agregaciones sobre prima, premio
     * o suma asegurada. Los valores se devuelven exactamente como
     * fueron recibidos desde la API.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Información económica de los certificados.
     */
    async obtenerCertificadosSumas(fecha: string): Promise<FedPatCertificadoSuma[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatCertificadosSumasResponse>(
                `${this.baseUrl}/v1/cartera/certificados-sumas`,
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

        return response.data.certificados_sumas;
    }
}