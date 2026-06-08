import { RusCarteraService } from "./rus/services/rusCarteraService";
import { obtenerDetallePropuesta } from "./rus/services/rusPropuestasService";

async function main() {

    try {

        const PRODUCTOR = 10571;
        const FECHA_EMISION = "2026-05-27";



        const pruebas: [number, number, number, number][] = [
            [4, 7933416, 1, 0],
            [4, 7235127, 1, 9]
        ];
        
        for (const [ramo, propuesta, endoso, renovacion] of pruebas) {
        
            try {
        
                console.log("");
                console.log("=================================");
                console.log(
                    `PROBANDO ${ramo}/${propuesta}/${endoso}/${renovacion}`
                );
                console.log("=================================");


        
                const detalle =
                    await obtenerDetallePropuesta(
                        ramo,
                        propuesta,
                        endoso,
                        renovacion
                    );
        
                console.log(
                    JSON.stringify(
                        detalle,
                        null,
                        2
                    )
                );
        
            } catch {
        
                console.log(
                    "No respondió."
                );
            }
        }

    } catch (error) {

        console.error(
            "ERROR OBTENIENDO DETALLE:"
        );

        console.error(error);
    }
}

main();