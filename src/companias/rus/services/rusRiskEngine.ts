import { TipoRiesgo } from "../../../models/TipoRiesgo";
import { RusPropuesta } from "../models/rusPropuestasInterfaces";


export class RusRiskEngine {

    /**
     * Premio mínimo para considerar un riesgo como "premio alto".
     */
    private static readonly PREMIO_ALTO_MINIMO = 7_000_000;


    /**
     * Secciones de RUS que corresponden a vehículos.
     */
    private static readonly SECCIONES_VEHICULOS = [
        4,   // Automotores
        20   // Motovehículos
    ];

    /**
     * Detecta los riesgos de una propuesta de RUS. 
     * @param propuesta La propuesta de RUS a evaluar. 
     * @returns Un arreglo de tipos de riesgo detectados en la propuesta. 
     * @see TipoRiesgo
     * @see RusPropuesta 
    */
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


    /**
     * Detecta si una propuesta de RUS corresponde a un riesgo de flota. 
     * @param propuesta La propuesta de RUS a evaluar. 
     * @returns true si la propuesta corresponde a un riesgo de flota, false en caso contrario. 
     * @see TipoRiesgo
     * @see RusPropuesta 
    */
    private static esFlota(propuesta: RusPropuesta): boolean {
        
        return (this.SECCIONES_VEHICULOS.includes(propuesta.numeroSeccion) && propuesta.esFlota === true);
    }

    /**
     * Detecta si una propuesta de RUS corresponde a un riesgo de premio alto. 
     * @param propuesta La propuesta de RUS a evaluar. 
     * @returns true si la propuesta corresponde a un riesgo de premio alto, false en caso contrario. 
     * @see TipoRiesgo
     * @see RusPropuesta 
    */
    private static esPremioAlto(propuesta: RusPropuesta): boolean {

        return ( Number.isFinite(propuesta.premio) && propuesta.premio >= this.PREMIO_ALTO_MINIMO);
    }
}