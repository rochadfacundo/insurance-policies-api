import { Poliza } from "../../../models/poliza";
import { TipoRiesgo } from "../../../models/TipoRiesgo";
import { MercantilBienesPolizaManager } from "../models/mercantilBienesPolizaManager";
import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";

export class MercantilRiskEngine {

    /**
     * Límite de prima alta para pólizas de Mercantil.
     */
    private static readonly PRIMA_ALTA_MINIMA = 5_000_000;

    /**
     * Identificador de la rama Automotores en Mercantil.
     */
     private static readonly RAMA_AUTOMOTORES = 5;

    /**
     * Detecta los riesgos de una póliza de Mercantil. 
     * @param poliza póliza a analizar 
     * @param detalle detalle de la póliza a analizar 
     * @param bienes bienes de la póliza a analizar 
     * @returns un arreglo de tipos de riesgo detectados en la póliza.
     * @see TipoRiesgo 
     */
    static detectar(poliza: Poliza, detalle: MercantilDetallePolizaManager, bienes: MercantilBienesPolizaManager): TipoRiesgo[] {

        if (this.tienePrimaNegativa(poliza)) {
            return [];
        }

        const riesgos = new Set<TipoRiesgo>();

        if (this.esFlota(detalle, bienes)) {
            riesgos.add(TipoRiesgo.FLOTA);
        }

        if (this.tienePrimaAlta(poliza)) {
            riesgos.add(TipoRiesgo.PRIMA_ALTA);
        }

        return Array.from(riesgos);
    }

    /**
     * Detecta pólizas cuya prima es negativa. 
     * @param poliza póliza a analizar 
     * @returns true si la prima es negativa, false en caso contrario
     * @see Poliza
     */
    private static tienePrimaNegativa(poliza: Poliza): boolean {
        const prima = poliza.riesgo.prima;
    
        return prima !== undefined && prima !== null && prima < 0;
    }

    /**
     * Una póliza se considera flota solamente cuando:
     * - pertenece a la rama Automotores;
     * - posee más de un bien asegurado.
     */
    /**
     * Detecta pólizas de flota según el detalle y los bienes de la póliza.
     * Se considera flota si la póliza pertenece a la rama Automotores y tiene más de un bien asegurado.
     * Si alguna de estas condiciones no se cumple, la póliza no se considera flota. 
     * @param detalle detalle de la póliza a analizar 
     * @param bienes bienes de la póliza a analizar 
     * @returns true si la póliza es de flota, false en caso contrario
     * @see MercantilDetallePolizaManager
     * @see MercantilBienesPolizaManager 
     */
    private static esFlota(detalle: MercantilDetallePolizaManager,bienes: MercantilBienesPolizaManager): boolean {
    
        const esAutomotor = detalle.getRamaId() === this.RAMA_AUTOMOTORES;
    
        const tieneMultiplesBienes = bienes.getCantidadBienes() > 1;
    
        return esAutomotor && tieneMultiplesBienes;
    }
    
    /**
     * Detecta pólizas de prima alta según el riesgo de la póliza.
     * Una póliza se considera de prima alta si su prima es mayor o igual a PRIMA_ALTA_MINIMA. 
     * @param poliza póliza a analizar 
     * @returns true si la póliza es de prima alta, false en caso contrario
     * @see Poliza 
     */
    private static tienePrimaAlta(poliza: Poliza): boolean {

        const prima = poliza.riesgo.prima ?? 0;

        return prima >= this.PRIMA_ALTA_MINIMA;
    }
}