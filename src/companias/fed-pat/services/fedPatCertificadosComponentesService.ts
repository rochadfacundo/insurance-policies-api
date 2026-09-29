import axios from "axios";
import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCertificadoComponente } from "../models/fedPatCertificadoComponente";
import { FedPatCertificadosComponentesResponse } from "../models/fedPatCertificadosComponentesResponse";


/**
 * Servicio responsable de consultar los componentes económicos
 * asociados a los certificados informados por la API de Cartera
 * de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Cada componente se encuentra relacionado con una combinación de
 * ramo, póliza, certificado y endoso, e identifica el concepto
 * mediante el campo `codigo`.
 *
 * Los valores se conservan exactamente como son informados por
 * Federación Patronal. La interpretación económica de cada componente
 * se realizará posteriormente en las capas de mapeo o negocio.
 */
export class FedPatCertificadosComponentesService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los componentes económicos informados por Federación
     * Patronal para una fecha determinada.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * No se realizan agregaciones ni transformaciones sobre `valor`,
     * ya que los registros pertenecen a movimientos de endoso y
     * pueden contener importes positivos o negativos.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Componentes económicos correspondientes a la fecha.
     */
    async obtenerCertificadosComponentes(fecha: string): Promise<FedPatCertificadoComponente[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatCertificadosComponentesResponse>(
                `${this.baseUrl}/v1/cartera/certificados-componentes`,
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


        return response.data.componentes;
    }
}