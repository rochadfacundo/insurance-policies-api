import axios from "axios";

/**
 * Utilidades HTTP compartidas por los servicios de Federación Patronal.
 *
 * La API puede cerrar ocasionalmente una conexión mientras se procesa
 * una consulta extensa. Estos errores de transporte son transitorios
 * y pueden resolverse repitiendo la misma solicitud.
 */
export class FedPatHttpUtils {

    /**
     * Cantidad máxima de intentos para una operación HTTP.
     *
     * Incluye el intento original.
     */
    private static readonly MAX_INTENTOS = 4;

    /**
     * Espera inicial entre reintentos.
     *
     * Cada nuevo intento duplica el tiempo de espera para evitar
     * insistir inmediatamente contra un servicio temporalmente inestable.
     */
    private static readonly ESPERA_INICIAL_MS = 1_000;

    /**
     * Ejecuta una operación HTTP y reintenta únicamente cuando el error
     * corresponde a una falla transitoria de transporte.
     *
     * No se reintentan errores funcionales o respuestas HTTP inválidas,
     * ya que repetirlas no solucionaría el problema.
     *
     * @param operacion Operación HTTP que se desea ejecutar.
     * @returns Resultado producido por la operación.
     */
    static async ejecutarConRetry<T>(
        operacion: () => Promise<T>
    ): Promise<T> {

        for (
            let intento = 1;
            intento <= this.MAX_INTENTOS;
            intento++
        ) {
            try {
                return await operacion();
            } catch (error: unknown) {

                const esReintentable =
                    this.esErrorReintentable(error);

                const ultimoIntento =
                    intento === this.MAX_INTENTOS;

                if (
                    !esReintentable ||
                    ultimoIntento
                ) {
                    throw error;
                }

                const espera =
                    this.ESPERA_INICIAL_MS *
                    (2 ** (intento - 1));

                console.warn(
                    `⚠ Error HTTP transitorio de Federación Patronal. ` +
                    `Reintentando en ${espera} ms ` +
                    `(intento ${intento + 1}/${this.MAX_INTENTOS})...`
                );

                await this.esperar(
                    espera
                );
            }
        }

        /*
         * El flujo normal nunca alcanza este punto porque cada intento
         * retorna un resultado o el último vuelve a lanzar el error.
         *
         * Se mantiene únicamente para satisfacer el contrato de retorno
         * de TypeScript sin utilizar assertions.
         */
        throw new Error(
            "No fue posible completar la operación HTTP de Federación Patronal."
        );
    }

    /**
     * Determina si un error de Axios representa una falla transitoria
     * de transporte que puede resolverse mediante un nuevo intento.
     *
     * Por ahora contemplamos explícitamente ECONNRESET, que corresponde
     * al cierre inesperado de la conexión observado durante el bootstrap.
     */
    private static esErrorReintentable(
        error: unknown
    ): boolean {

        if (!axios.isAxiosError(error)) {
            return false;
        }

        return error.code === "ECONNRESET";
    }

    /**
     * Suspende la ejecución durante el tiempo indicado sin bloquear
     * el event loop de Node.js.
     */
    private static esperar(
        milisegundos: number
    ): Promise<void> {

        return new Promise(
            resolve => setTimeout(
                resolve,
                milisegundos
            )
        );
    }
}