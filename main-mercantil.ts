import { MercantilCarteraService }
from "./mercantil/services/mercantilCarteraService";

async function main() {

    try {

        const PRODUCTORES = [

            /*
            NO ASOCIADO AUN
            {
                codigo: 95848,
                nombre: "Técnica y Servicios"
            },*/

            {
                codigo: 83973,
                nombre: "De Maio Mónica"
            },

            {
                codigo: 96826,
                nombre: "Oggero Cristian"
            }
        ];

        const carteraService =  new MercantilCarteraService();

        for (const productor of PRODUCTORES) {

            console.log("");
            console.log("=================================");
            console.log(
                `${productor.nombre} (${productor.codigo})`
            );
            console.log("=================================");

            const cartera = await carteraService.obtenerCarteraCompleta(productor.codigo);

            console.log(`Pólizas encontradas: ${cartera.getCantidad()}`);

                try {

                    const manager = await carteraService.obtenerCarteraCompleta(productor.codigo);

                    
                     const flotas =  manager.getFlotas();
                    
                    console.log(
                        `Flotas encontradas: ${flotas.length}`
                    );
                    
                    for (const flota of flotas) {
                    
                        console.log({
                            poliza: flota.poliza,
                            asegurado: flota.nombreAsegurado,
                            bienAsegurado: flota.bienAsegurado
                        });
                    }
                

                } catch (error: any) {

        
                }
            }


        

    } catch (error) {

        console.error("ERROR ANALIZANDO CARTERA:");

        console.error(error);
    }
}

main();