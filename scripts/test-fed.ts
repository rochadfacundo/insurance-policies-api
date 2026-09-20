import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// El .env está una carpeta arriba de /scripts
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("FEDERACIÓN PATRONAL - PRUEBA DE AUTENTICACIÓN");
    console.log("==================================================");
    console.log("");

    const clientId = process.env.FED_PAT_CLIENT_ID;
    const clientSecret = process.env.FED_PAT_CLIENT_SECRET;
    const username = process.env.FED_PAT_USERNAME;
    const password = process.env.FED_PAT_PASSWORD;

    if (!clientId || !clientSecret || !username || !password) {
        throw new Error(
            "Faltan credenciales de Federación Patronal en el .env"
        );
    }

    console.log(`Client ID: ${clientId}`);
    console.log(`Usuario: ${username}`);
    console.log("Client Secret: cargado");
    console.log("Password: cargado");
    console.log("");

    const url = "https://api.fedpat.com.ar/oauth/token";

    const body = new URLSearchParams();

    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);

    try {

        console.log("Solicitando token...");

        const response = await axios.post(
            url,
            body.toString(),
            {
                auth: {
                    username: clientId,
                    password: clientSecret
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        console.log("");
        console.log("✅ AUTENTICACIÓN EXITOSA");
        console.log("");
        console.log(`Status: ${response.status}`);

        console.log({
            token_type: response.data?.token_type,
            expires_in: response.data?.expires_in,
            scope: response.data?.scope,
            jti: response.data?.jti,
            tieneAccessToken: Boolean(response.data?.access_token)
        });

        // No mostramos el token completo por seguridad.
        if (response.data?.access_token) {
            console.log("");
            console.log(
                `Token recibido correctamente (${response.data.access_token.length} caracteres).`
            );
        }

    } catch (error: unknown) {

        console.error("");
        console.error("❌ ERROR AUTENTICANDO CONTRA FEDERACIÓN PATRONAL");
        console.error("");

        if (axios.isAxiosError(error)) {

            console.error("Status:", error.response?.status);
            console.error("Status text:", error.response?.statusText);

            console.error("");
            console.error("Respuesta:");
            console.error(error.response?.data);

            console.error("");
            console.error("Headers:");
            console.error(error.response?.headers);

        } else {

            console.error(error);
        }

        process.exitCode = 1;
    }
}

main()
    .then(() => {

        console.log("");
        console.log("Prueba finalizada.");

    })
    .catch((error: unknown) => {

        console.error("");
        console.error("Error general:");
        console.error(error);

        process.exitCode = 1;
    });