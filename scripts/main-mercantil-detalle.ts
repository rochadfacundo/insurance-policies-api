import { obtenerProductoresMercantil } from "../src/companias/mercantil/models/productoresMercantil";
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
        console.log("DETALLE POLIZAS MERCANTIL");
        console.log("========================================");
        console.log(`${productor.nombre} (${productor.codigo})`);
        console.log("");

        const cartera = await carteraService.obtenerCarteraCompleta(productor.codigo);

        for (const poliza of cartera.getPolizas()) {

            console.log("========================================");
            console.log(`Póliza: ${poliza.poliza}`);
            console.log(`Endoso: ${poliza.endoso}`);
            console.log(`Asegurado: ${poliza.nombreAsegurado}`);
            console.log("");

            const detalle = await carteraService.obtenerDetallePoliza(
                poliza.poliza,
                poliza.endoso
            );
            
            carteraMercantil.push({
                productor: {
                    codigo: productor.codigo,
                    nombre: productor.nombre
                },
                poliza: poliza.poliza,
                endoso: poliza.endoso,
                asegurado: poliza.nombreAsegurado,
                detalle
            });
            
        
        }

    }

    guardarJson(carteraMercantil, "mercantil-detalles.json");

    console.log("");
    console.log("========================================");
    console.log(`Detalles guardados: ${carteraMercantil.length}`);
    console.log("========================================");
    

    } catch (error) {

        console.error(error);
    }
}

main();