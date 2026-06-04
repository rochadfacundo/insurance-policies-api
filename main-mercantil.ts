import { MercantilPolizasManager } from "./mercantil/models/mercantilPolizasManager";
import { obtenerPolizasVigentes }
from "./mercantil/services/mercantilPolizasService";


async function main() {

    try {

        const respuesta =  await obtenerPolizasVigentes(97715, 100, 0);

        const manager = new MercantilPolizasManager(respuesta);

        console.log("\n=== NOMBRE DEL PRODUCTOR ===");
        console.log(manager.getNombreProductor());
        console.log("\n=== RESUMEN ===");
        console.log(manager.toString());

    } catch (error: any) {

        console.error(
            error?.response?.status
        );

        console.error(
            error?.response?.data
        );
    }
}

main();