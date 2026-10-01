import axios from "axios";
import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatProductoDato } from "../models/fedPatProductoDato";
import { FedPatProductosDatosResponse } from "../models/fedPatProductosDatosResponse";
import { FedPatHttpUtils } from "../utils/fedPatHttpUtils";

/**
 * Servicio responsable de consultar los datos específicos de los
 * productos o bienes asegurados informados por la API de Cartera
 * de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Los registros obtenidos contienen pares `codigo_dato` / `valor_dato`
 * asociados a un ramo, póliza, certificado y endoso.
 *
 * Este servicio no interpreta los códigos ni transforma sus valores.
 * La resolución de códigos mediante los catálogos correspondientes
 * se realizará posteriormente en las capas de mapeo y negocio.
 */
export class FedPatProductosDatosService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los datos de productos informados por Federación
     * Patronal para una fecha determinada.
     *
     * La consulta utiliza el mecanismo de retry compartido para tolerar
     * errores transitorios de transporte durante la reconstrucción
     * histórica de la cartera.
     *
     * Los registros se devuelven sin filtrar ni transformar para mantener
     * intacta la relación original entre póliza, certificado, endoso,
     * código de dato y valor.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Datos de productos correspondientes a la fecha.
     */
    async obtenerProductosDatos(fecha: string): Promise<FedPatProductoDato[]> {

        const token = await this.authService.getAccessToken();

        /*
        * El retry envuelve únicamente la consulta HTTP.
        *
        * Ante un error transitorio como ECONNRESET se repite exactamente
        * la consulta de productos-datos para la misma fecha.
        */
        const response = await FedPatHttpUtils.ejecutarConRetry(
                () =>
                    axios.get<FedPatProductosDatosResponse>(
                        `${this.baseUrl}/v1/cartera/productos-datos`,
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

        return response.data.producto_datos;
    }
}