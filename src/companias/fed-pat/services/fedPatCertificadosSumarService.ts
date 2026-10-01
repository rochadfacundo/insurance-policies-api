import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";
import { FedPatCertificadosSumasResponse } from "../models/fedPatCertificadosSumasResponse";
import { FedPatHttpUtils } from "../utils/fedPatHttpUtils";

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
     * La consulta utiliza el mecanismo de retry compartido para tolerar
     * errores transitorios de transporte durante la reconstrucción
     * histórica de la cartera.
     *
     * Los valores económicos se conservan sin transformaciones; cualquier
     * interpretación de prima, premio o suma asegurada corresponde a las
     * capas posteriores de negocio.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Información económica de los certificados.
     */
    async obtenerCertificadosSumas(fecha: string): Promise<FedPatCertificadoSuma[]> {

        const token = await this.authService.getAccessToken();

        /*
        * El retry afecta únicamente a la operación HTTP.
        *
        * Ante un error transitorio como ECONNRESET se repite la consulta
        * de certificados-sumas para la misma fecha.
        */
        const response = await FedPatHttpUtils.ejecutarConRetry(
                () =>
                    axios.get<FedPatCertificadosSumasResponse>(
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
                    )
            );

        return response.data.certificados_sumas;
    }
}