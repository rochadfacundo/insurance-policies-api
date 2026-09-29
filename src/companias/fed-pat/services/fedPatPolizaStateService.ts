import { FedPatPolizaState } from "../models/fedPatPolizaState";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";
import { FedPatProductoDato } from "../models/fedPatProductoDato";
import { FedPatRiesgoCubierto } from "../models/fedPatRiesgoCubierto";
import { FedPatCertificadoComponente } from "../models/fedPatCertificadoComponente";
import { FedPatCertificado } from "../models/fetPatCertificado";


/**
 * Representa toda la información recibida desde los endpoints
 * diarios de Cartera de Federación Patronal.
 *
 * Todos los arrays corresponden a la misma fecha de consulta.
 */
export interface FedPatFeedDiario {
    fecha: string;

    certificados: FedPatCertificado[];
    endosos: FedPatCertificadoEndoso[];
    sumas: FedPatCertificadoSuma[];
    productosDatos: FedPatProductoDato[];
    riesgosCubiertos: FedPatRiesgoCubierto[];
    componentes: FedPatCertificadoComponente[];
}


/**
 * Servicio responsable de construir y actualizar el estado acumulado
 * conocido de las pólizas de Federación Patronal.
 *
 * La API entrega información por fecha y no un snapshot completo
 * de toda la cartera. Por lo tanto, la ausencia de una póliza o
 * certificado en un día determinado NO implica su eliminación.
 *
 * Este servicio:
 * - agrupa registros por ramo + número de póliza;
 * - conserva información obtenida en días anteriores;
 * - reemplaza registros repetidos según su clave natural;
 * - permite reprocesar una fecha sin duplicar información;
 * - mantiene monotónicamente la última fecha procesada.
 *
 * No aplica reglas de negocio ni determina riesgos.
 */
export class FedPatPolizaStateService {

    /**
     * Incorpora un feed diario al estado acumulado existente.
     *
     * @param estados Estados conocidos antes de procesar el día.
     * @param feed Información obtenida de Federación para una fecha.
     * @returns Estados actualizados.
     */
    acumularFeed(
        estados: Map<string, FedPatPolizaState>,
        feed: FedPatFeedDiario
    ): Map<string, FedPatPolizaState> {

        /*
         * Primero garantizamos que exista un estado para cualquier
         * póliza presente en cualquiera de los endpoints.
         */
        this.crearEstadosNecesarios(
            estados,
            feed
        );


        // --------------------------------------------------
        // CERTIFICADOS
        // --------------------------------------------------

        for (const certificado of feed.certificados) {

            const estado =
                this.obtenerEstado(
                    estados,
                    certificado.codigo_ramo,
                    certificado.numero_poliza
                );

            estado.certificados =
                this.upsert(
                    estado.certificados,
                    certificado,
                    item =>
                        this.claveCertificado(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }


        // --------------------------------------------------
        // ENDOSOS
        // --------------------------------------------------

        for (const endoso of feed.endosos) {

            const estado =
                this.obtenerEstado(
                    estados,
                    endoso.codigo_ramo,
                    endoso.numero_poliza
                );

            estado.endosos =
                this.upsert(
                    estado.endosos,
                    endoso,
                    item =>
                        this.claveEndoso(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }


        // --------------------------------------------------
        // SUMAS
        // --------------------------------------------------

        for (const suma of feed.sumas) {

            const estado =
                this.obtenerEstado(
                    estados,
                    suma.codigo_ramo,
                    suma.numero_poliza
                );

            /*
             * certificados-sumas no incluye número de endoso.
             *
             * Por el momento utilizamos:
             * ramo + póliza + certificado
             *
             * como clave natural.
             *
             * Los duplicados observados en las pruebas reales de
             * Federación resultaron económicamente idénticos.
             */
            estado.sumas =
                this.upsert(
                    estado.sumas,
                    suma,
                    item =>
                        this.claveCertificado(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }


        // --------------------------------------------------
        // PRODUCTOS DATOS
        // --------------------------------------------------

        for (const productoDato of feed.productosDatos) {

            const estado =
                this.obtenerEstado(
                    estados,
                    productoDato.codigo_ramo,
                    productoDato.numero_poliza
                );

            estado.productosDatos =
                this.upsert(
                    estado.productosDatos,
                    productoDato,
                    item =>
                        this.claveProductoDato(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }


        // --------------------------------------------------
        // RIESGOS CUBIERTOS
        // --------------------------------------------------

        for (const riesgoCubierto of feed.riesgosCubiertos) {

            const estado =
                this.obtenerEstado(
                    estados,
                    riesgoCubierto.codigo_ramo,
                    riesgoCubierto.numero_poliza
                );

            estado.riesgosCubiertos =
                this.upsert(
                    estado.riesgosCubiertos,
                    riesgoCubierto,
                    item =>
                        this.claveRiesgoCubierto(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }


        // --------------------------------------------------
        // COMPONENTES
        // --------------------------------------------------

        for (const componente of feed.componentes) {

            const estado =
                this.obtenerEstado(
                    estados,
                    componente.codigo_ramo,
                    componente.numero_poliza
                );

            estado.componentes =
                this.upsert(
                    estado.componentes,
                    componente,
                    item =>
                        this.claveComponente(item)
                );

            this.actualizarUltimaFechaProcesada(
                estado,
                feed.fecha
            );
        }

        return estados;
    }


    /**
     * Crea estados vacíos para todas las pólizas encontradas
     * en cualquiera de las colecciones del feed.
     *
     * Esto es necesario porque una póliza podría aparecer en un
     * endpoint de detalle sin aparecer ese mismo día en certificados.
     */
    private crearEstadosNecesarios(
        estados: Map<string, FedPatPolizaState>,
        feed: FedPatFeedDiario
    ): void {

        const registros = [
            ...feed.certificados,
            ...feed.endosos,
            ...feed.sumas,
            ...feed.productosDatos,
            ...feed.riesgosCubiertos,
            ...feed.componentes
        ];

        for (const registro of registros) {

            const clave =
                this.clavePoliza(
                    registro.codigo_ramo,
                    registro.numero_poliza
                );

            if (!estados.has(clave)) {

                estados.set(
                    clave,
                    this.crearEstadoVacio(
                        registro.codigo_ramo,
                        registro.numero_poliza,
                        feed.fecha
                    )
                );
            }
        }
    }


    /**
     * Crea la estructura inicial para una póliza que todavía
     * no fue observada durante la sincronización.
     */
    private crearEstadoVacio(
        codigoRamo: number,
        numeroPoliza: number,
        fecha: string
    ): FedPatPolizaState {

        return {
            codigoRamo,
            numeroPoliza,
            certificados: [],
            endosos: [],
            sumas: [],
            productosDatos: [],
            riesgosCubiertos: [],
            componentes: [],
            ultimaFechaProcesada: fecha
        };
    }


    /**
     * Recupera un estado previamente creado.
     *
     * Si no existe se considera un error interno, ya que
     * crearEstadosNecesarios debe ejecutarse previamente.
     */
    private obtenerEstado(
        estados: Map<string, FedPatPolizaState>,
        codigoRamo: number,
        numeroPoliza: number
    ): FedPatPolizaState {

        const clave =
            this.clavePoliza(
                codigoRamo,
                numeroPoliza
            );

        const estado =
            estados.get(clave);

        if (!estado) {
            throw new Error(
                `No existe estado para la póliza ${clave}`
            );
        }

        return estado;
    }


    /**
     * Inserta un registro nuevo o reemplaza el existente cuando
     * ambos poseen la misma clave natural.
     *
     * De esta forma el procesamiento es idempotente: volver a
     * procesar un mismo feed no genera registros duplicados.
     */
    private upsert<T>(
        registros: T[],
        nuevoRegistro: T,
        obtenerClave: (registro: T) => string
    ): T[] {

        const claveNueva =
            obtenerClave(nuevoRegistro);

        const indice =
            registros.findIndex(
                registro =>
                    obtenerClave(registro) === claveNueva
            );

        if (indice === -1) {

            return [
                ...registros,
                nuevoRegistro
            ];
        }

        const resultado =
            [...registros];

        resultado[indice] =
            nuevoRegistro;

        return resultado;
    }


    /**
     * Actualiza la última fecha procesada de una póliza sin permitir
     * que el estado retroceda temporalmente.
     *
     * Esto es importante porque una fecha histórica puede ser
     * reprocesada después de haber procesado feeds más recientes.
     *
     * Ejemplo:
     *
     * Estado actual: 15/09/2026
     * Feed reprocesado: 10/09/2026
     *
     * Resultado:
     * ultimaFechaProcesada continúa siendo 15/09/2026.
     */
    private actualizarUltimaFechaProcesada(
        estado: FedPatPolizaState,
        nuevaFecha: string
    ): void {

        const fechaActual =
            this.convertirFechaAComparable(
                estado.ultimaFechaProcesada
            );

        const fechaNueva =
            this.convertirFechaAComparable(
                nuevaFecha
            );

        if (fechaNueva > fechaActual) {
            estado.ultimaFechaProcesada =
                nuevaFecha;
        }
    }


    /**
     * Convierte una fecha dd/MM/yyyy a una representación numérica
     * yyyyMMdd apta para comparaciones cronológicas.
     *
     * No utilizamos Date ni Date.parse() porque la fecha del feed
     * representa únicamente una fecha calendario y no un instante
     * temporal. De esta forma evitamos problemas de timezone.
     *
     * Ejemplo:
     *
     * 15/09/2026 -> 20260915
     */
    private convertirFechaAComparable(
        fecha: string
    ): number {

        const partes =
            fecha.split("/");

        if (partes.length !== 3) {
            throw new Error(
                `Formato de fecha inválido: ${fecha}`
            );
        }

        const [
            dia,
            mes,
            anio
        ] = partes.map(Number);

        if (
            !Number.isInteger(dia) ||
            !Number.isInteger(mes) ||
            !Number.isInteger(anio)
        ) {
            throw new Error(
                `Formato de fecha inválido: ${fecha}`
            );
        }

        return (
            anio! * 10000 +
            mes! * 100 +
            dia!
        );
    }


    /**
     * Identidad interna de una póliza dentro de Federación.
     *
     * El número de póliza no se considera globalmente único:
     * incluimos también el ramo.
     */
    private clavePoliza(
        codigoRamo: number,
        numeroPoliza: number
    ): string {

        return `${codigoRamo}-${numeroPoliza}`;
    }


    /**
     * Clave natural de un certificado.
     *
     * Identifica un certificado dentro de una póliza y ramo.
     */
    private claveCertificado(
        registro: {
            codigo_ramo: number;
            numero_poliza: number;
            certificado: number;
        }
    ): string {

        return (
            `${registro.codigo_ramo}-` +
            `${registro.numero_poliza}-` +
            `${registro.certificado}`
        );
    }


    /**
     * Un endoso se identifica por póliza, certificado y número
     * de endoso.
     *
     * Conservamos distintos endosos para poder reconstruir
     * posteriormente la evolución conocida del certificado.
     */
    private claveEndoso(
        registro: FedPatCertificadoEndoso
    ): string {

        return (
            `${this.claveCertificado(registro)}-` +
            `${registro.endoso}`
        );
    }


    /**
     * Un dato dinámico puede repetirse entre distintos endosos.
     *
     * El endoso forma parte de la clave para conservar su historia
     * y evitar que un movimiento posterior sobrescriba información
     * perteneciente a otro endoso.
     */
    private claveProductoDato(
        registro: FedPatProductoDato
    ): string {

        return (
            `${this.claveCertificado(registro)}-` +
            `${registro.endoso}-` +
            `${registro.codigo_dato}`
        );
    }


    /**
     * Una cobertura puede aparecer para distintos endosos.
     *
     * Conservamos cada movimiento independientemente mediante:
     *
     * certificado + endoso + ramo cobertura + cobertura.
     */
    private claveRiesgoCubierto(
        registro: FedPatRiesgoCubierto
    ): string {

        return (
            `${this.claveCertificado(registro)}-` +
            `${registro.endoso}-` +
            `${registro.codigo_ramo_cobertura}-` +
            `${registro.codigo_cobertura}`
        );
    }


    /**
     * Identidad de un componente económico dentro de un
     * certificado/endoso.
     *
     * El código del componente completa la clave porque un mismo
     * endoso puede contener múltiples componentes económicos.
     */
    private claveComponente(
        registro: FedPatCertificadoComponente
    ): string {

        return (
            `${this.claveCertificado(registro)}-` +
            `${registro.endoso}-` +
            `${registro.codigo}`
        );
    }
}