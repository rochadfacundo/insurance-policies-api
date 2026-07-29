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
     * Analiza una póliza de Mercantil y devuelve
     * los riesgos comerciales detectados.
     */
    static detectar(poliza: Poliza, detalle: MercantilDetallePolizaManager, bienes: MercantilBienesPolizaManager): TipoRiesgo[] {

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
     * Una póliza se considera flota solamente cuando:
     * - pertenece a la rama Automotores;
     * - posee más de un bien asegurado.
     */
    private static esFlota(detalle: MercantilDetallePolizaManager,bienes: MercantilBienesPolizaManager): boolean {
    
        const esAutomotor = detalle.getRamaId() === this.RAMA_AUTOMOTORES;
    
        const tieneMultiplesBienes = bienes.getCantidadBienes() > 1;
    
        return esAutomotor && tieneMultiplesBienes;
    }
    

    /**
     * Detecta pólizas cuya prima alcanza o supera
     * el límite comercial definido.
     */
    private static tienePrimaAlta(poliza: Poliza): boolean {

        const prima = poliza.riesgo.prima ?? 0;

        return prima >= this.PRIMA_ALTA_MINIMA;
    }
}