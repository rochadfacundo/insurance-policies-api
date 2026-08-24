import { ECompania } from "../../../models/eCompania";
import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
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
    static mapear(propuesta: RusPropuesta, productor: Productor,riesgos: Poliza["riesgos"]): Poliza {

        const inicioVigencia = DateUtils.parsearFecha(propuesta.inicioVigencia,"inicioVigencia");

        const finVigencia = DateUtils.parsearFecha(propuesta.finVigencia, "finVigencia");

        const inicioFacturacion = DateUtils.parsearFechaConFallback(propuesta.inicioPeriodoFacturacion,inicioVigencia);

        const finFacturacion = DateUtils.parsearFechaConFallback(propuesta.finPeriodoFacturacion,finVigencia);

        return {
            id: `RUS_${propuesta.numeroPoliza}`,
            compania: ECompania.RIO_URUGUAY,
            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre
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
     * Método privado que obtiene el nombre del asegurado a partir de la propuesta. 
     * @param propuesta es la propuesta de RUS de la cual se desea obtener el nombre del asegurado. 
     * @returns una cadena con el nombre del asegurado, ya sea el nombre de la persona o la razón social, 
     * o "SIN NOMBRE" si no se encuentra ninguno. 
     * @see RusPropuesta
     */
    private static obtenerNombreAsegurado(propuesta: RusPropuesta): string {

        const nombrePersona = propuesta.nombrePersona?.trim();

        if (nombrePersona) {
            return nombrePersona;
        }

        const razonSocial = propuesta.razonSocial?.trim();

        if (razonSocial) {
            return razonSocial;
        }

        return "SIN NOMBRE";
    }


}