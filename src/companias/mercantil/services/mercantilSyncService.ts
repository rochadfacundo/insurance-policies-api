import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { MercantilPolizaMapper } from "../mapper/mercantilPolizaMapper";
import { MercantilCarteraService } from "./mercantilCarteraService";
import { MercantilRiskEngine } from "./mercantilRiskEngine";
import axios from "axios";
import { ECompania } from "../../../models/eCompania";
import { FirestoreErrorRepository } from "../../../repositories/firebaseErrorRepository";


export class MercantilSyncService {

  constructor(
    private readonly mercantilService =  new MercantilCarteraService(),
    private readonly errorRepository = new FirestoreErrorRepository()
) {}

    /**
     * Sincroniza la cartera completa de un productor.
     */
    async sincronizar(productor: Productor): Promise<Poliza[]> {

      const resultado: Poliza[] = [];
  
      const cartera = await this.mercantilService.obtenerCarteraCompleta(productor.codigo);
  
      for (const polizaMercantil of cartera.getPolizas()) {
  
          try {

            const poliMercantil = polizaMercantil.poliza;
            const endosoMercantil = polizaMercantil.endoso;

            const detalle = await this.mercantilService.obtenerDetallePoliza(poliMercantil, endosoMercantil);
            const bienes = await this.mercantilService.obtenerBienesPoliza(poliMercantil, endosoMercantil);
  
            const poliza = MercantilPolizaMapper.mapear(polizaMercantil,detalle,productor,bienes);
  
            poliza.riesgos = MercantilRiskEngine.detectar(poliza,detalle,bienes);
                
                if (poliza.riesgos.length > 0) {
                    resultado.push(poliza);
                }
  
              } catch (error) {

                const mensaje = error instanceof Error ? error.message : "Error desconocido"
                const detalle = axios.isAxiosError(error) ? error.response?.data : undefined;
            
                console.warn(`Se omitió la póliza ${polizaMercantil.poliza}, endoso ${polizaMercantil.endoso}`);
            
                console.warn(mensaje);
            
                try {
            
                    const idError = await this.errorRepository.guardar({
                            compania: ECompania.MERCANTIL_ANDINA,
                            productor,
                            poliza: polizaMercantil.poliza,
                            endoso: polizaMercantil.endoso,
                            servicio: "bienes",
                            mensaje,
                            detalle
                        });
            
                    console.log(`Error guardado en Firestore con ID: ${idError}`);
            
                } catch (errorFirestore) {
            
                    console.error("No se pudo guardar el error en Firestore:");
                    console.error(errorFirestore);
                }
            }
      }
  
      return resultado;
  }
}