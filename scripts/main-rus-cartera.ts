import { obtenerProductoresRUS } from "../src/companias/rus/productoresRUS";
import { RusCarteraService } from "../src/companias/rus/services/rusCarteraService";
import { guardarJson } from "../src/utils/jsonUtils";

async function main() {
  try {
    const productores = obtenerProductoresRUS();
    const carteraService = new RusCarteraService();

    const carteraRus: any[] = [];

    console.log("");
    console.log("========================================");
    console.log("CARTERA CRUDA RUS");
    console.log("========================================");

    for (const productor of productores) {
      console.log("");
      console.log("========================================");
      console.log(`${productor.nombre} (${productor.codigo})`);
      console.log("========================================");

      try {
        const cartera = await carteraService.obtenerUltimoAnio(productor.codigo);

        const propuestas = cartera.getPropuestas();

        console.log(`Propuestas encontradas: ${propuestas.length}`);

        carteraRus.push({
          codigoProductor: productor.codigo,
          nombreProductor: productor.nombre,
          cantidadPropuestas: propuestas.length,
          propuestas
        });

      } catch (error: any) {
        console.error(`Error procesando productor ${productor.codigo}`);
        console.error(error?.message);
      }
    }

    console.log("");
    console.log("Exportando cartera cruda...");

    guardarJson(carteraRus, "carteraRus2.json");

    console.log("Archivo generado: carteraRus2.json");

  } catch (error) {
    console.error("ERROR OBTENIENDO CARTERA CRUDA RUS:");
    console.error(error);
  }
}

main();