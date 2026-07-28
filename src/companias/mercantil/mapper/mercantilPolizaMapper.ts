import { ECompania } from "../../../models/eCompania";
import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { DateUtils } from "../../../utils/dateUtils";
import { MercantilBienesPolizaManager } from "../models/mercantilBienesPolizaManager";
import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";
import { MercantilPoliza } from "../models/mercantilModelPolizas";

export class MercantilPolizaMapper {

    static mapear(
        cartera: MercantilPoliza,
        detalle: MercantilDetallePolizaManager,
        productor: Productor,
        bienes?: MercantilBienesPolizaManager
    ): Poliza {
// TODO: utilizar bienes para detectar
// cantidad de vehículos, suma asegurada, etc.

    const desde = DateUtils.parse(cartera.desde);

    const hastaFacturacion = DateUtils.parse(cartera.hasta);

    const hastaVigencia = DateUtils.parse(cartera.finPoliza);

    const poliza= {

                id: `MERCANTIL_${cartera.poliza}`,
            
                compania: ECompania.MERCANTIL_ANDINA,
            
                productor: {
                    codigo: productor.codigo,
                    nombre: productor.nombre
                },
            
                cliente: {
                    nombre: cartera.nombreAsegurado
                },
            
                detallePoliza: {

                    numeroPoliza: cartera.poliza,    
                    endoso: cartera.endoso
                
                },
            
                riesgo: {

                    cobertura: detalle.getCobertura(),
                
                    premio: detalle.getPremio(),
                
                    prima: detalle.getPrima()
                
                },
            
                riesgos: [],
            
                facturacion: {
                    desde,
                    hasta: hastaFacturacion             
                },
                
                vigencia: {             
                    desde,            
                    hasta: hastaVigencia,            
                    diasParaVencer: DateUtils.diasHasta(hastaVigencia),               
                    tipo: DateUtils.obtenerTipoVigencia(desde, hastaVigencia)
                
                },
            
            } satisfies Poliza;
            
            return poliza;

    }

}