import { RusCarteraService } from "./rus/services/rusCarteraService";


async function main() {

    try {

        // organizador: 8381
        //const ORGANIZADOR = 8381;

        // productor: 7716
        const PRODUCTOR = 7716;


        console.log("=================================");
        console.log("ANÁLISIS DE CARTERA RUS");
        console.log("=================================");
        console.log(`Productor: ${PRODUCTOR}`);
        console.log("Consultando último año...");
        console.log("");

        const carteraService =  new RusCarteraService();

        const manager = await carteraService.obtenerUltimos30Dias(PRODUCTOR);

        

        console.log("=================================");
        console.log("RESUMEN");
        console.log("=================================");

        console.log("Nombre productor:",manager.getProductor());

        console.log("Cantidad de propuestas:",manager.getCantidad());

        console.log("Premio total cartera:",manager.getPremioTotal().toLocaleString("es-AR"));

        console.log("");

        const flotas =  manager.getFlotas();

        const riesgosMayores =  manager.getConPremioMayorA(5000000);

        console.log(`Flotas detectadas: ${flotas.length}`);

        console.log(`Pólizas con premio superior a $5.000.000: ${riesgosMayores.length}`);

        console.log("");

        console.log("=================================");
        console.log("FLOTAS");
        console.log("=================================");

        if (flotas.length === 0) {

            console.log("No se encontraron flotas.");

        } else {

            for (const propuesta of flotas) {

                console.log({
                    poliza: propuesta.numeroPoliza,

                    asegurado: propuesta.nombrePersona,

                    cobertura: propuesta.cobertura,

                    premio: propuesta.premio.toLocaleString("es-AR")
                });
            }
        }

        console.log("");
        console.log("=================================");
        console.log("PREMIOS MAYORES A $5.000.000");
        console.log("=================================");

        if (riesgosMayores.length === 0) {

            console.log("No se encontraron riesgos de alto valor.");

        } else {

            for (const propuesta of riesgosMayores) {

                console.log({
                    poliza: propuesta.numeroPoliza,

                    asegurado: propuesta.nombrePersona,

                    cobertura: propuesta.cobertura,

                    premio: propuesta.premio.toLocaleString("es-AR"),

                    esFlota: propuesta.esFlota  });
            }
        }

        console.log("");
        console.log("=================================");
        console.log("FIN DEL ANÁLISIS");
        console.log("=================================");

    } catch (error) {

        console.error(
            "ERROR ANALIZANDO CARTERA:"
        );

        console.error(error);
    }
}

main();