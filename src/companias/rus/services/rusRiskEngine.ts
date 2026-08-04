import { TipoRiesgo } from "../../../models/TipoRiesgo";
import { RusPropuesta } from "../models/rusPropuestasInterfaces";


export class RusRiskEngine {

    private static readonly SECCION_AUTOMOTORES = 4;

    private static readonly PREMIO_ALTO_MINIMO = 7_000_000;

    static detectar(propuesta: RusPropuesta): TipoRiesgo[] {

        const riesgos: TipoRiesgo[] = [];

        if (this.esFlota(propuesta)) {
            riesgos.push(TipoRiesgo.FLOTA);
        }

        if (this.esPremioAlto(propuesta)) {
            riesgos.push(TipoRiesgo.PREMIO_ALTO);
        }

        return riesgos;
    }

    private static readonly SECCIONES_VEHICULOS = [
        4,   // Automotores
        20   // Motovehículos
    ];

    private static esFlota(propuesta: RusPropuesta): boolean {
        
        return (this.SECCIONES_VEHICULOS.includes(propuesta.numeroSeccion) &&propuesta.esFlota === true);
    }

    private static esPremioAlto(propuesta: RusPropuesta): boolean {

        return ( Number.isFinite(propuesta.premio) && propuesta.premio >= this.PREMIO_ALTO_MINIMO);
    }
}