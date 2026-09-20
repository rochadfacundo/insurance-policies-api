import { ECompania } from "../../../models/eCompania";
import { Poliza } from "../../../models/poliza";
import { Productor, ProductorBase } from "../../../models/productor";
import { TipoVigencia } from "../../../models/tipoVigencia";
import { DateUtils } from "../../../utils/dateUtils";
import { RusPropuesta } from "../models/rusPropuestasInterfaces";

export class RusPolizaMapper {


    /**
     * Mapea una propuesta de RUS a una póliza del modelo general.
     * Primero se parsean las fechas de vigencia y facturación, 
     * luego se construye el objeto Poliza con los datos de la propuesta y del productor. 
     * Finalmente, se retorna el objeto Poliza mapeado.
     * @param propuesta es la propuesta de RUS a mapear. 
     * @param productor es el productor asociado a la propuesta. 
     * @param riesgos son los riesgos detectados para la propuesta. 
     * @returns un objeto Poliza mapeado a partir de la propuesta, productor y riesgos.
     * @see Poliza 
     * @see RusPropuesta
     */
    static mapear(propuesta: RusPropuesta, productor: ProductorBase,riesgos: Poliza["riesgos"]): Poliza {

        const inicioVigencia = DateUtils.parsearFecha(propuesta.inicioVigencia,"inicioVigencia");

        const finVigencia = DateUtils.parsearFecha(propuesta.finVigencia, "finVigencia");

        const inicioFacturacion = DateUtils.parsearFechaConFallback(propuesta.inicioPeriodoFacturacion,inicioVigencia);

        const finFacturacion = DateUtils.parsearFechaConFallback(propuesta.finPeriodoFacturacion,finVigencia);

        return {
            id: `RUS_${propuesta.numeroPoliza}`,
            compania: ECompania.RIO_URUGUAY,
            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre,
            },
            cliente: {
                nombre: this.obtenerNombreAsegurado(propuesta)
            },
            detallePoliza: {
                numeroPoliza: propuesta.numeroPoliza,
                endoso: propuesta.endoso
            },
            riesgo: {
                cobertura: propuesta.cobertura?.trim() || propuesta.interesAsegurable?.trim() || "SIN COBERTURA INFORMADA",
                // Si premioPoliza es nulo, se utiliza el premio de la propuesta. 
                // Esto es para manejar casos donde RUS no informa el premio de la póliza.
                premio: propuesta.premioPoliza ?? propuesta.premio,
                // RUS no informa prima separada en este modelo.
                prima: 0
            },
            riesgos,
            facturacion: {
                desde: inicioFacturacion,
                hasta: finFacturacion
            },
            vigencia: {
                desde: inicioVigencia,
                hasta: finVigencia,
                diasParaVencer: DateUtils.calcularDiasParaVencer(finVigencia),
                tipo: DateUtils.calcularTipoVigencia(inicioVigencia,finVigencia)
            }
        };
    }

    /**
     * Obtiene el nombre del asegurado a partir de una propuesta de RUS.
     * @param propuesta es la propuesta de RUS de la cual se quiere obtener el nombre del asegurado.
     * @returns El nombre del asegurado, que puede ser el nombre de la persona física o la razón social de la persona jurídica,
     *  dependiendo de la información disponible en la propuesta. Si no hay información disponible, retorna "SIN NOMBRE".
     * @see RusPropuesta
     */
    private static obtenerNombreAsegurado(propuesta: RusPropuesta): string {

        const nombrePersona = propuesta.nombrePersona?.trim();
    
        const razonSocial = propuesta.razonSocial?.trim();
    
        // Persona física:
        // RUS informa el apellido en razonSocial
        // y el/los nombres en nombrePersona.
        if (nombrePersona && razonSocial) {
            return `${razonSocial} ${nombrePersona}`;
        }
    
        // Si solamente existe nombrePersona.
        if (nombrePersona) {
            return nombrePersona;
        }
    
        // Persona jurídica o caso donde RUS
        // solamente informa razonSocial.
        if (razonSocial) {
            return razonSocial;
        }
    
        return "SIN NOMBRE";
    }


}