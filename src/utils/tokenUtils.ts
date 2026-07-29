
import fs from "fs";
import path from "path";
import { TokenData } from "../models/tokenData";

const TOKENS_DIR = path.resolve(__dirname,"../tokens");

function asegurarDirectorioTokens(): void {

    if (!fs.existsSync(TOKENS_DIR)) {

        fs.mkdirSync(TOKENS_DIR,{ recursive: true });

    }

}

export function guardarToken(compania: string,data: TokenData): void {

    asegurarDirectorioTokens();

    const archivo = path.join(TOKENS_DIR,`${compania}.json`);

    fs.writeFileSync(archivo,JSON.stringify(data,null,2),"utf8");

}

export function leerToken(compania: string): TokenData | null {

    asegurarDirectorioTokens();

    const archivo = path.join(TOKENS_DIR,`${compania}.json`);

    if (!fs.existsSync(archivo)) {
        return null;
    }

    try {

        const contenido =fs.readFileSync(archivo,"utf8");

        return JSON.parse(contenido) as TokenData;

    } catch (error) {

        console.error(`Error leyendo token de ${compania}:`,error);

        return null;

    }

}

export function borrarToken(compania: string): void {

    const archivo = path.join(TOKENS_DIR,`${compania}.json`);

    if (
        fs.existsSync(archivo)
    ) {

        fs.unlinkSync(archivo);

    }

}

export function tokenExpirado(token: string): boolean {

    try {

        const partes = token.split(".");

        if (
            partes.length < 2
        ) {
            return true;
        }

        const payloadBase64 = partes[1]!;

        const payload = JSON.parse(Buffer.from(payloadBase64,"base64").toString());

        if (
            !payload.exp
        ) {
            return true;
        }

        const ahora = Math.floor(Date.now() / 1000);

        return payload.exp <= ahora;

    } catch {

        return true;

    }

}