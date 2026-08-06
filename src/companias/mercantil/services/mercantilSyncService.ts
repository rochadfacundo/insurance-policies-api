import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { MercantilPolizaMapper } from "../mapper/mercantilPolizaMapper";
import { MercantilCarteraService } from "./mercantilCarteraService";
import { MercantilRiskEngine } from "./mercantilRiskEngine";
import axios from "axios";
import { ECompania } from "../../../models/eCompania";
import { FirestoreErrorRepository } from "../../../repositories/firebaseErrorRepository";

/**
 * Servicio para sincronizar la cartera de un productor en Mercantil, detectando riesgos y transformándolos al modelo general Poliza.
 */
export class MercantilSyncService {

  /**
   * Crea una instancia de MercantilSyncService. 
   * @param mercantilService instancia de MercantilCarteraService para obtener la cartera de un productor. 
   * @param errorRepository  instancia de FirestoreErrorRepository para guardar errores de sincronización en Firestore.
   */
  constructor(
    private readonly mercantilService =  new MercantilCarteraService(),
    private readonly errorRepository = new FirestoreErrorRepository()
) {}

    /**
     * Sincroniza la cartera de un productor en Mercantil, detectando riesgos y transformándolos al modelo general Poliza.
     * Si ocurre un error al procesar una póliza, se guarda el error en Firestore y se omite la póliza.
     * @param productor productor para el cual se realizará la sincronización. 
     * @returns un arreglo de objetos Poliza con las pólizas detectadas y sus riesgos.
     * @see Poliza
     * @see MercantilPolizaMapper  
     * @see MercantilRiskEngine
     * @see FirestoreErrorRepository
     * @see MercantilCarteraService
     * @see Productor
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