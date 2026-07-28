import { ECompania } from "../../../models/eCompania";
import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { TipoVigencia } from "../../../models/tipoVigencia";
import { RusPropuesta } from "../models/rusPropuestasInterfaces";

export class RusPolizaMapper {

    static mapear(propuesta: RusPropuesta, productor: Productor,riesgos: Poliza["riesgos"]): Poliza {

        const inicioVigencia = this.parsearFecha(propuesta.inicioVigencia,"inicioVigencia");

        const finVigencia = this.parsearFecha(propuesta.finVigencia, "finVigencia");

        const inicioFacturacion = this.parsearFechaConFallback(propuesta.inicioPeriodoFacturacion,inicioVigencia);

        const finFacturacion = this.parsearFechaConFallback(propuesta.finPeriodoFacturacion,finVigencia);

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
                premio: propuesta.premio,
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
                diasParaVencer: this.calcularDiasParaVencer(finVigencia),
                tipo: this.calcularTipoVigencia(inicioVigencia,finVigencia)
            }
        };
    }

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

    private static parsearFecha(valor: string,campo: string): Date {

        if (!valor?.trim()) {
            throw new Error(`RUS no informó ${campo}.`);
        }

        const fecha = new Date(`${valor.substring(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            throw new Error(`Fecha inválida en ${campo}: ${valor}`);
        }

        return fecha;
    }

    private static parsearFechaConFallback(valor: string | null | undefined,fallback: Date): Date {

        if (!valor?.trim()) {
            return new Date(
                fallback.getTime()
            );
        }

        const fecha = new Date(`${valor.substring(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            return new Date(fallback.getTime());
        }

        return fecha;
    }

    private static calcularDiasParaVencer(fechaHasta: Date): number {

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const hasta = new Date(fechaHasta);
        hasta.setHours(0, 0, 0, 0);

        const diferencia = hasta.getTime() - hoy.getTime();

        return Math.ceil(diferencia /(1000 * 60 * 60 * 24));
    }

    private static calcularTipoVigencia(desde: Date, hasta: Date): TipoVigencia {

        const dias = Math.round(( hasta.getTime() - desde.getTime()) /(1000 * 60 * 60 * 24));

        if (dias <= 35) {
            return TipoVigencia.MENSUAL;
        }

        if (dias <= 70) {
            return TipoVigencia.BIMESTRAL;
        }

        if (dias <= 100) {
            return TipoVigencia.TRIMESTRAL;
        }

        if (dias <= 135) {
            return TipoVigencia.CUATRIMESTRAL;
        }

        if (dias <= 200) {
            return TipoVigencia.SEMESTRAL;
        }

        if (dias <= 380) {
            return TipoVigencia.ANUAL;
        }

        return TipoVigencia.OTRA;
    }
}