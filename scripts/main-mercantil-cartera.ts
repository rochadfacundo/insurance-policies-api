import { obtenerProductoresMercantil } from "../src/companias/mercantil/models/productoresMercantil";
import { MercantilPoliza } from "../src/companias/mercantil/models/mercantilModelPolizas";
import { MercantilCarteraService } from "../src/companias/mercantil/services/mercantilCarteraService";
import { guardarJson } from "../src/utils/jsonUtils";

async function main() {

    try {

        const productores = obtenerProductoresMercantil();

        const carteraService = new MercantilCarteraService();

        const carteraMercantil: any[] = [];

        console.log("");
        console.log("========================================");
        console.log("CARTERA CRUDA MERCANTIL");
        console.log("========================================");

        for (const productor of productores) {

            console.log("");
            console.log("========================================");
            console.log(`${productor.nombre} (${productor.codigo})`);
            console.log("========================================");

            try {

                const cartera =
                    await carteraService.obtenerCarteraCompleta(productor.codigo);

                const polizas: MercantilPoliza[] =
                    cartera.getPolizas();

                console.log(`Pólizas encontradas: ${polizas.length}`);

                carteraMercantil.push({

                    codigoProductor: productor.codigo,

                    nombreProductor: productor.nombre,

                    cantidadPolizas: polizas.length,

                    polizas

                });

            } catch (error: any) {

                console.error(`Error procesando productor ${productor.codigo}`);

                console.error(error?.message);
            }
        }

        console.log("");
        console.log("========================================");
        console.log("RESUMEN");
        console.log("========================================");

        console.log(`Productores: ${carteraMercantil.length}`);

        console.log("Exportando cartera...");

        guardarJson(
            carteraMercantil,
            "carteraMercantil.json"
        );

        console.log("Archivo generado: carteraMercantil.json");

    } catch (error) {

        console.error("ERROR OBTENIENDO CARTERA MERCANTIL");

        console.error(error);
    }
}

main();