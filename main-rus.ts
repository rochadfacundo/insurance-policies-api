import { RusPropuestasRequest } from "./rus/models/rusInterfaces";
import { RusPropuestasManager } from "./rus/models/rusPropuestasManager";
import { obtenerPropuestas } from "./rus/services/rusPropuestasService";

async function main() {

    try {

        const request: RusPropuestasRequest = {
            codigoProductor: [8381],
            fechaEmision: "2025-11-13",
            pagina: 0
        };

        const response = await obtenerPropuestas(request);

        const manager = new RusPropuestasManager(response);

        console.log("=== RESUMEN ===");
        console.log(manager.getResumen());

        console.log("=== PRODUCTOR ===");
        console.log(manager.getProductor());


        console.log("=== VIGENTES ===");
        console.log(manager.getVigentes().length);

        console.log("=== VENCIDAS ===");
        console.log(manager.getVencidas().length);

        console.log("=== RENOVACIONES ===");
        console.log(manager.getRenovaciones().length);

        console.log("=== NUEVAS ===");
        console.log(manager.getNuevas().length);

        console.log("=== PROXIMAS A RENOVAR (30 DIAS) ===");
        console.log(manager.getProximasARenovar(30));

        console.log("=== RESUMEN RENOVACIONES ===");
        console.log(manager.getResumenRenovaciones(30));



    } catch (error: any) {

        console.error("STATUS:", error?.response?.status);
        console.error("DATA:", error?.response?.data);
        console.error("MESSAGE:", error?.message);
    }
}

main();