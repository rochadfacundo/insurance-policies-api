import axios from "axios";
import { FedPatAuthTokenResponse } from "../models/fedPathAuthTokenResponse";

/**
 * Servicio responsable de la autenticación contra la API
 * de Federación Patronal.
 *
 * Obtiene y mantiene en memoria el access token utilizado por
 * los servicios de Cartera.
 *
 * El token se reutiliza mientras continúe vigente para evitar
 * realizar una autenticación nueva en cada request.
 */
export class FedPatAuthService {

    private readonly baseUrl: string;
    private readonly username: string;
    private readonly password: string;
    private readonly clientId: string;
    private readonly clientSecret: string;

    private accessToken: string | null = null;
    private tokenExpirationTime = 0;

    /**
     * Margen utilizado para considerar vencido el token algunos
     * segundos antes de su expiración real.
     *
     * Evita iniciar una request utilizando un token que podría
     * vencer durante la ejecución de la consulta.
     */
    private readonly expirationMarginMs = 60 * 1000;

    constructor() {

        this.baseUrl =
            process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";

        this.username =
            this.getRequiredEnv("FED_PAT_USERNAME");

        this.password =
            this.getRequiredEnv("FED_PAT_PASSWORD");

        this.clientId =
            this.getRequiredEnv("FED_PAT_CLIENT_ID");

        this.clientSecret =
            this.getRequiredEnv("FED_PAT_CLIENT_SECRET");
    }

    /**
     * Devuelve un access token válido.
     *
     * Si existe un token en memoria y todavía no se encuentra próximo
     * a vencer, se reutiliza. En caso contrario se solicita uno nuevo
     * al servidor OAuth de Federación Patronal.
     */
    async getAccessToken(): Promise<string> {

        if (this.hasValidToken()) {
            return this.accessToken as string;
        }

        return this.requestNewToken();
    }

    /**
     * Determina si actualmente existe un token reutilizable.
     */
    private hasValidToken(): boolean {

        if (!this.accessToken) {
            return false;
        }

        return Date.now() <
            this.tokenExpirationTime - this.expirationMarginMs;
    }

    /**
     * Solicita un nuevo access token utilizando OAuth 2.0.
     *
     * Federación Patronal utiliza Basic Authentication para
     * CLIENT_ID / CLIENT_SECRET y grant_type=password para las
     * credenciales correspondientes al productor u organizador.
     */
    private async requestNewToken(): Promise<string> {

        const body = new URLSearchParams();

        body.append("grant_type", "password");
        body.append("username", this.username);
        body.append("password", this.password);

        const response = await axios.post<FedPatAuthTokenResponse>(
            `${this.baseUrl}/oauth/token`,
            body.toString(),
            {
                auth: {
                    username: this.clientId,
                    password: this.clientSecret
                },
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        const tokenData = response.data;

        this.accessToken = tokenData.access_token;

        /*
         * Calculamos localmente el momento de expiración utilizando
         * expires_in, expresado por la API en segundos.
         */
        this.tokenExpirationTime =
            Date.now() + tokenData.expires_in * 1000;

        return this.accessToken;
    }

    /**
     * Obtiene una variable de entorno obligatoria.
     *
     * Se lanza un error inmediatamente si la configuración requerida
     * para la integración no se encuentra disponible.
     */
    private getRequiredEnv(name: string): string {

        const value = process.env[name];

        if (!value) {
            throw new Error(
                `Variable de entorno requerida no configurada: ${name}`
            );
        }

        return value;
    }
}