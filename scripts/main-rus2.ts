import axios from "axios";

import { getRusConfig } from "../src/companias/rus/config";

const PRODUCTOR = 8381;
const FECHA_EMISION = "2026-07-27";

async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("TEST DE AUTENTICACIÓN RUS - ORGANIZADOR");
    console.log("==================================================");

    try {

        const config = getRusConfig();

        console.log("");
        console.log("CONFIGURACIÓN CARGADA");

        console.log({
            ambiente: config.env,
            baseUrl: config.baseUrl,
            username: enmascararUsuario(config.username),
            usernameTieneBarra: config.username.includes("/"),
            apiKeyPresente: Boolean(config.apiKey),
            apiKeyLongitud: config.apiKey.length
        });

        /*
         * LOGIN DIRECTO.
         *
         * No utiliza obtenerTokenRUS(), por lo tanto no puede
         * reutilizar el token anterior guardado en caché.
         */
        console.log("");
        console.log("--------------------------------------------------");
        console.log("1. SOLICITANDO TOKEN NUEVO");
        console.log("--------------------------------------------------");

        const loginUrl =
            `${config.baseUrl}/login/token`;

        const loginResponse =
            await axios.post(
                loginUrl,
                {
                    username: config.username,
                    password: config.password
                },
                {
                    headers: {
                        "x-api-key": config.apiKey,
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    timeout: 30_000
                }
            );

        const token =
            loginResponse.data?.access_token;

        if (
            typeof token !== "string" ||
            !token.trim()
        ) {
            throw new Error(
                `El login respondió correctamente, pero no devolvió access_token. ` +
                `Respuesta: ${JSON.stringify(loginResponse.data)}`
            );
        }

        console.log("Token nuevo obtenido correctamente.");

        console.log({
            status: loginResponse.status,
            tokenPresente: true,
            tokenLongitud: token.length,
            refreshTokenPresente:
                Boolean(loginResponse.data?.refresh_token)
        });

        /*
         * CONSULTA DIRECTA A PROPUESTAS.
         */
        console.log("");
        console.log("--------------------------------------------------");
        console.log("2. CONSULTANDO PROPUESTAS");
        console.log("--------------------------------------------------");

        const propuestasUrl =
            `${config.baseUrl}/propuestas/propuestas`;

        const body = {
            codigoProductor: [
                PRODUCTOR
            ],
            fechaEmision:
                FECHA_EMISION,
            pagina:
                0
        };

        console.log({
            url: propuestasUrl,
            productor: PRODUCTOR,
            fechaEmision: FECHA_EMISION,
            pagina: 0
        });

        const propuestasResponse =
            await axios.post(
                propuestasUrl,
                body,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        "x-api-key":
                            config.apiKey,

                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json"
                    },

                    timeout:
                        30_000,

                    validateStatus:
                        () => true
                }
            );

        console.log("");
        console.log("--------------------------------------------------");
        console.log("3. RESPUESTA DE PROPUESTAS");
        console.log("--------------------------------------------------");

        console.log({
            status:
                propuestasResponse.status,

            statusText:
                propuestasResponse.statusText
        });

        console.log(
            JSON.stringify(
                propuestasResponse.data,
                null,
                2
            )
        );

        console.log("");
        console.log("==================================================");
        console.log("DIAGNÓSTICO");
        console.log("==================================================");

        if (
            propuestasResponse.status >= 200 &&
            propuestasResponse.status < 300
        ) {

            const resultados =
                Array.isArray(
                    propuestasResponse.data?.results
                )
                    ? propuestasResponse.data.results
                    : [];

            console.log(
                "El usuario organizador pudo consultar propuestas correctamente."
            );

            console.log({
                resultadosPagina:
                    resultados.length,

                total:
                    propuestasResponse.data
                        ?.paging
                        ?.total
            });

            return;
        }

        if (
            propuestasResponse.status === 403
        ) {

            console.log(
                "El token nuevo fue generado, pero RUS sigue rechazando el acceso a propuestas."
            );

            console.log(
                "Esto indicaría que la cuenta organizadora todavía no tiene habilitado el recurso /propuestas/propuestas, o que el productor consultado no está asociado a ese organizador."
            );

            process.exitCode = 1;

            return;
        }

        if (
            propuestasResponse.status === 401
        ) {

            console.log(
                "RUS rechazó el token o la API key."
            );

            process.exitCode = 1;

            return;
        }

        console.log(
            `RUS respondió con status inesperado ${propuestasResponse.status}.`
        );

        process.exitCode = 1;

    } catch (error: any) {

        console.error("");
        console.error("==================================================");
        console.error("ERROR EN TEST RUS");
        console.error("==================================================");

        console.error({
            mensaje:
                error?.message,

            status:
                error?.response?.status,

            detalle:
                error?.response?.data,

            url:
                error?.config?.url
        });

        process.exitCode = 1;
    }
}

function enmascararUsuario(
    username: string
): string {

    if (username.length <= 4) {
        return "***";
    }

    return (
        username.substring(0, 3) +
        "***" +
        username.substring(
            username.length - 3
        )
    );
}

main();