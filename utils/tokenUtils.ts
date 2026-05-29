import fs from "fs";

const TOKEN_FILE = "./token.json";

export function guardarToken(token: string) {

    fs.writeFileSync(
        TOKEN_FILE,
        JSON.stringify({
            token
        }, null, 2)
    );
}

export function leerToken(): string | null {

    if (!fs.existsSync(TOKEN_FILE)) {
        return null;
    }

    const data = JSON.parse(
        fs.readFileSync(TOKEN_FILE, "utf8")
    );

    return data.token;
}

export function tokenExpirado(token: string): boolean {

    try {

        const payloadBase64 = token.split(".")[1];

        if (!payloadBase64) {
            return true;
        }

        const payload = JSON.parse(
            Buffer.from(
                payloadBase64,
                "base64"
            ).toString()
        );

        const ahora = Math.floor(
            Date.now() / 1000
        );

        return payload.exp <= ahora;

    } catch {

        return true;
    }
}