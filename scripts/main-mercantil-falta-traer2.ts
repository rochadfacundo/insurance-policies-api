import { MercantilCarteraService } from "../src/companias/mercantil/services/mercantilCarteraService";

async function main(): Promise<void> {

    const productores = [

        {
            codigo: 98439,
            nombre: "Tassone, Jessica Cristina"
        },

        {
            codigo: 99254,
            nombre: "Ontoria Barbara Estefania"
        }

    ];

    const carteraService = new MercantilCarteraService();

    for (const productor of productores) {

        console.log("");
        console.log("========================================");
        console.log(`${productor.nombre} (${productor.codigo})`);
        console.log("========================================");

        try {

            const cartera =
                await carteraService.obtenerCarteraCompleta(
                    productor.codigo
                );

            console.log(
                `✅ OK - Pólizas encontradas: ${cartera.getCantidad()}`
            );

        } catch (error: any) {

            if (error?.response?.status === 403) {

                console.log("❌ Sigue sin estar vinculado.");

                continue;
            }

            console.error("Error:");

            console.error(error?.message);

            if (error?.response?.status) {

                console.error(
                    `HTTP ${error.response.status}`
                );
            }
        }
    }
}

main();