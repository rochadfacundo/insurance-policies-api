import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatPlan } from "../models/fedPatPlan";

/**
 * Resuelve la descripción comercial de las coberturas
 * asociadas al estado actual conocido de una póliza
 * de Federación Patronal.
 *
 * La relación observada en los datos reales es:
 *
 * `endoso.codigo_producto + endoso.codigo_plan`
 *                      ↓
 * catálogo `/cartera/prodplanes`
 *
 * IMPORTANTE:
 *
 * Los endosos recibidos representan el historial acumulado de
 * la póliza. Para evitar que planes históricos aparezcan como
 * coberturas actuales, solamente se considera el último endoso
 * conocido de cada certificado.
 *
 * Una póliza puede contener certificados actualmente vigentes
 * con planes diferentes, por lo que se conservan todas las
 * descripciones actuales encontradas, sin duplicados.
 *
 * Este componente no consulta la API y no interviene en los
 * cálculos de prima, premio ni detección de riesgos.
 */
export class FedPatCoberturaResolve {

    /**
     * Obtiene una descripción agregada de los planes comerciales
     * correspondientes al último estado conocido de cada certificado.
     *
     * El valor `Total` se ignora porque no representa un plan
     * comercial presente en el catálogo `/cartera/prodplanes`.
     *
     * @param endosos Historial acumulado de endosos de la póliza.
     * @param planes Catálogo completo de planes de Federación.
     * @returns Descripciones únicas separadas por " / ",
     *          o null cuando no puede resolverse ninguna.
     */
    resolver(
        endosos: FedPatCertificadoEndoso[],
        planes: FedPatPlan[]
    ): string | null {

        const ultimosEndosos =
            this.obtenerUltimoEndosoPorCertificado(endosos);

        const descripciones = new Set<string>();

        for (const endoso of ultimosEndosos) {

            const codigoProducto =
                this.normalizar(endoso.codigo_producto);

            const codigoPlan =
                this.normalizar(endoso.codigo_plan);

            if (
                codigoProducto === null ||
                codigoPlan === null ||
                codigoPlan.toUpperCase() === "TOTAL"
            ) {
                continue;
            }

            const plan = planes.find(item =>
                this.normalizar(item.codProductor) === codigoProducto &&
                this.normalizar(item.plan) === codigoPlan
            );

            const descripcion =
                this.normalizar(plan?.descripcion);

            if (descripcion !== null) {
                descripciones.add(descripcion);
            }
        }

        if (descripciones.size === 0) {
            return null;
        }

        return Array.from(descripciones).join(" / ");
    }

    /**
     * Conserva únicamente el endoso con mayor número para cada
     * certificado de la póliza.
     *
     * La clave es el número de certificado porque cada certificado
     * puede evolucionar independientemente y mantener un plan
     * comercial diferente al resto de la póliza.
     *
     * El Map evita accesos inseguros por índice y permite representar
     * explícitamente la ausencia de un endoso previo.
     */
    private obtenerUltimoEndosoPorCertificado(
        endosos: FedPatCertificadoEndoso[]
    ): FedPatCertificadoEndoso[] {

        const ultimoPorCertificado =
            new Map<number, FedPatCertificadoEndoso>();

        for (const endoso of endosos) {

            const actual =
                ultimoPorCertificado.get(endoso.certificado) ?? null;

            if (
                actual === null ||
                endoso.endoso > actual.endoso
            ) {
                ultimoPorCertificado.set(
                    endoso.certificado,
                    endoso
                );
            }
        }

        return Array.from(
            ultimoPorCertificado.values()
        );
    }

    /**
     * Normaliza strings provenientes de la API para realizar
     * comparaciones consistentes y tolerar valores históricos
     * nulos, vacíos o con espacios adicionales.
     */
    private normalizar(
        valor: string | null | undefined
    ): string | null {

        if (typeof valor !== "string") {
            return null;
        }

        const normalizado = valor.trim();

        return normalizado.length > 0
            ? normalizado
            : null;
    }
}