import dotenv from "dotenv";

import { FedPatAuthService } from
    "../src/companias/fed-pat/services/fedPatAuthService";

import { FedPatProductoresService } from
    "../src/companias/fed-pat/services/fedPatProductoresService";

dotenv.config({
    path: "../.env"
});

async function main(): Promise<void> {

    const authService = new FedPatAuthService();

    const productoresService =
        new FedPatProductoresService(authService);

    const productores =
        await productoresService.obtenerProductores();

    console.log("======================================");
    console.log("PRODUCTORES FEDERACIÓN PATRONAL");
    console.log("======================================");

    console.log(`Total productores: ${productores.length}`);

    console.log("");

    console.log("Primeros 10 productores:");

    console.dir(productores.slice(0, 10), {
        depth: null
    });
}

main().catch(console.error);