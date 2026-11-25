import { ECompania } from "../../../models/eCompania";
import { PolizaCartera } from "../../../models/polizaCartera";
import { Productor } from "../../../models/productor";
import { PeriodicidadFacturacion } from "../../../models/periodicidadFacturacion";
import { DateUtils } from "../../../utils/dateUtils";
import { MercantilDetallePolizaManager } from "../models/mercantilDetallePolizaManager";
import { MercantilPoliza } from "../models/mercantilModelPolizas";

export class MercantilPolizaCarteraMapper {

    /**
     * Transforma una póliza de Mercantil al modelo
     * general de cartera.
     *
     * Admite pólizas sin asociación a un PAS y pólizas
     * transferidas sin información económica disponible.
     */
    static mapear(
        cartera: MercantilPoliza,
        detalleActual: MercantilDetallePolizaManager,
        detalleFacturacion: MercantilDetallePolizaManager | null,
        productor: Productor,
        pasId: string | null,
        periodicidadFacturacion: PeriodicidadFacturacion,
        historialRestringido: boolean
    ): PolizaCartera {

        const poliza: PolizaCartera = {

            // ==========================================
            // IDENTIFICACIÓN
            // ==========================================

            id: `MERCANTIL_${cartera.poliza}`,

            compania: ECompania.MERCANTIL_ANDINA,

            pasId,

            // ==========================================
            // PRODUCTOR
            // ==========================================

            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre,

                matricula: productor.matricula !== null
                    ? String(productor.matricula)
                    : null,

                ...(productor.grupoCartera
                    ? { grupoCartera: productor.grupoCartera }
                    : {})
            },

            // ==========================================
            // ASEGURADO
            // ==========================================

            asegurado: {
                nombre: cartera.nombreAsegurado,
                codigo: cartera.codigoAsegurado
            },

            // ==========================================
            // PÓLIZA
            // ==========================================

            numeroPoliza: cartera.poliza,

            numeroPolizaAnterior:
                cartera.polizaAnterior > 0
                    ? cartera.polizaAnterior
                    : null,

            endoso: cartera.endoso,

            // ==========================================
            // RIESGO ASEGURADO
            // ==========================================

            ramo: {
                codigo: detalleActual.getRamaId(),
                nombre: detalleActual.getRamaNombre() ?? null
            },

            bienAsegurado: cartera.bienAsegurado,

            cobertura: detalleActual.getCobertura() ?? null,

            // ==========================================
            // INFORMACIÓN ECONÓMICA
            // ==========================================

            primaAnualizada: this.normalizarImporte(
                detalleFacturacion?.getPrimaAnualizada()
            ),

            premioAnualizado: this.normalizarImporte(
                detalleFacturacion?.getPremioAnualizado()
            ),

            endosoEconomico:
                detalleFacturacion?.getEndoso() ?? null,

            historialRestringido,

            // ==========================================
            // FACTURACIÓN
            // ==========================================

            facturacion: {
                desde: this.mapearFecha(
                    cartera.desde,
                    "desde"
                ),

                hasta: this.mapearFecha(
                    cartera.hasta,
                    "hasta"
                )
            },

            periodicidadFacturacion,

            // ==========================================
            // VIGENCIA CONTRACTUAL
            // ==========================================

            finVigencia: this.mapearFecha(
                cartera.finPoliza,
                "finPoliza"
            )
        };

        return poliza;
    }

    /**
     * Normaliza los importes económicos a dos decimales.
     * Conserva null cuando no existe información.
     */
    private static normalizarImporte(
        importe: number | null | undefined
    ): number | null {

        if (importe === null || importe === undefined) {
            return null;
        }

        if (!Number.isFinite(importe)) {
            throw new Error(
                `Importe económico inválido: ${importe}`
            );
        }

        return Number(importe.toFixed(2));
    }

    /**
     * Convierte y valida las fechas informadas por Mercantil.
     */
    private static mapearFecha(
        valor: string,
        campo: string
    ): Date {

        const fecha = DateUtils.parse(valor);

        if (!Number.isFinite(fecha.getTime())) {
            throw new Error(
                `[MERCANTIL] Fecha inválida en ${campo}: ${valor}`
            );
        }

        return fecha;
    }
}