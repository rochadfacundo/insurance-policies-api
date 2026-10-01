import * as path from "path";
import * as dotenv from "dotenv";

import {
    FedPatPolizaState
} from "../src/companias/fed-pat/models/fedPatPolizaState";

import {
    FedPatFeedDiario,
    FedPatPolizaStateService
} from "../src/companias/fed-pat/services/fedPatPolizaStateService";

import {
    FedPatAuthService
} from "../src/companias/fed-pat/services/fedPatAuthService";

import {
    FedPatCertificadosService
} from "../src/companias/fed-pat/services/fedPatCertificadosService";

import {
    FedPatCertificadosEndososService
} from "../src/companias/fed-pat/services/fedPatCertificadosEndososService";

import {
    FedPatCertificadosSumasService
} from "../src/companias/fed-pat/services/fedPatCertificadosSumarService";

import {
    FedPatProductosDatosService
} from "../src/companias/fed-pat/services/fedPatProductosDatosService";

import {
    FedPatRiesgosCubiertosService
} from "../src/companias/fed-pat/services/fedPatRiesgosCubiertosService";

import {
    FedPatCertificadosComponentesService
} from "../src/companias/fed-pat/services/fedPatCertificadosComponentesService";

import {
    FedPatDatosService
} from "../src/companias/fed-pat/services/fedPatDatosService";

import {
    FedPatTablasService
} from "../src/companias/fed-pat/services/fedPatTablasService";

import {
    FedPatRiskEngine
} from "../src/companias/fed-pat/services/fedPatRiskEngine";

import {
    FedPatClientesService
} from "../src/companias/fed-pat/services/fedPatClientesService";

import {
    FedPatProductoresService
} from "../src/companias/fed-pat/services/fedPatProductoresService";

import {
    FedPatPolizaContextService
} from "../src/companias/fed-pat/services/fetPatPolizaMapperContext";

import {
    FedPatCliente
} from "../src/companias/fed-pat/models/fedPatCliente";

import {
    TipoRiesgo
} from "../src/models/TipoRiesgo";

import {
    DateUtils
} from "../src/utils/dateUtils";
import { FedPatFacturacionService } from "../src/companias/fed-pat/services/fedPatFacturacionService";


/**
 * Carga las variables de entorno necesarias para autenticarse
 * y consultar la API de Federación Patronal.
 *
 * El script se ejecuta desde /scripts, por lo que el archivo .env
 * se encuentra un nivel por encima.
 */
dotenv.config({
    path: path.resolve(
        process.cwd(),
        "../.env"
    )
});


/**
 * Rango histórico utilizado para reconstruir la cartera.
 *
 * Federación Patronal publica información de cartera por día cerrado,
 * por lo que se utiliza el día anterior como límite superior.
 *
 * A partir de esa fecha se reconstruyen los últimos 365 días.
 */
const FECHA_HASTA =
    DateUtils.restarDiasDDMMYYYY(
        DateUtils.formatearFechaDDMMYYYY(
            new Date()
        ),
        1
    );

const FECHA_DESDE =
    DateUtils.restarDiasDDMMYYYY(
        FECHA_HASTA,
        365
    );


/**
 * Punto de entrada del bootstrap histórico de riesgos
 * de Federación Patronal.
 *
 * Flujo:
 *
 * API Federación Patronal
 *          ↓
 * feeds diarios
 *          ↓
 * FedPatPolizaStateService
 *          ↓
 * estados acumulados en memoria
 *          ↓
 * FedPatRiskEngine
 *          ↓
 * pólizas con riesgo
 *
 * IMPORTANTE:
 *
 * Esta versión no inicializa Firebase Admin ni utiliza repositorios
 * Firestore.
 *
 * Los registros técnicos obtenidos desde Federación existen solamente
 * durante la ejecución del proceso y no son persistidos.
 */
async function main(): Promise<void> {

    const inicio = Date.now();


    console.log(
        "=================================================="
    );

    console.log(
        "SINCRONIZACIÓN DE RIESGOS FEDERACIÓN PATRONAL"
    );

    console.log(
        "=================================================="
    );

    console.log(
        `Período: ${FECHA_DESDE} -> ${FECHA_HASTA}`
    );


    /*
     * Todos los servicios de Federación comparten la misma instancia
     * de autenticación.
     */
    const authService =
        new FedPatAuthService();

    const certificadosService =
        new FedPatCertificadosService(
            authService
        );

    const endososService =
        new FedPatCertificadosEndososService(
            authService
        );

    const sumasService =
        new FedPatCertificadosSumasService(
            authService
        );

    const productosDatosService =
        new FedPatProductosDatosService(
            authService
        );

    const riesgosCubiertosService =
        new FedPatRiesgosCubiertosService(
            authService
        );

    const componentesService =
        new FedPatCertificadosComponentesService(
            authService
        );

    const datosService =
        new FedPatDatosService(
            authService
        );

    const tablasService =
        new FedPatTablasService(
            authService
        );

    /*
     * Los clientes se obtienen mediante feeds diarios.
     *
     * Se acumulan por separado del estado técnico de las pólizas
     * porque posteriormente se utilizan para resolver el asegurado
     * asociado al certificado principal.
     */
    const clientesService =
        new FedPatClientesService(
            authService
        );

    /**
     * El catálogo de productores no depende de una fecha.
     *
     * Por ese motivo se consulta una única vez una vez finalizada
     * la reconstrucción histórica.
     */
    const productoresService =
        new FedPatProductoresService(
            authService
        );

    /**
     * Servicio encargado de resolver la información necesaria
     * para construir posteriormente el contexto del mapper.
     *
     * Las decisiones de selección se mantienen fuera del main
     * y fuera de FedPatPolizaMapper.
     */
    const contextService =
        new FedPatPolizaContextService();

    /*
     * Servicio encargado de reconstruir el estado acumulado conocido
     * de cada póliza a partir de los movimientos diarios.
     */
    const stateService =
        new FedPatPolizaStateService();

    /*
     * Motor que aplica las reglas de negocio:
     *
     * - FLOTA
     * - PRIMA_ALTA
     * - PREMIO_ALTO
     */
    const riskEngine =
        new FedPatRiskEngine();

    /*
    * Servicio encargado de resolver el movimiento representativo
    * del período de facturación de cada póliza.
    *
    * Se mantiene separado del RiskEngine porque la selección del
    * período de facturación no constituye una regla de riesgo.
    */
    const facturacionService = new FedPatFacturacionService();

    /*
     * Los estados RAW viven únicamente en memoria.
     *
     * La clave interna utilizada por FedPatPolizaStateService es:
     *
     * ramo + número de póliza.
     */
    const estados =
        new Map<string, FedPatPolizaState>();

    /*
     * Catálogo histórico de clientes reconstruido en memoria.
     *
     * La clave combina tipo de asegurado + código para mantener
     * exactamente el mismo criterio de identidad utilizado luego
     * por FedPatPolizaContextService.
     *
     * Los clientes no se persisten como información RAW.
     */
    const clientes =
        new Map<string, FedPatCliente>();


    /*
     * DateUtils genera todas las fechas del rango incluyendo
     * FECHA_DESDE y FECHA_HASTA.
     */
    const fechas =
        DateUtils.generarFechas(
            FECHA_DESDE,
            FECHA_HASTA
        );


    console.log("");

    console.log(
        `Días a consultar: ${DateUtils.formatearNumero(fechas.length)}`
    );

    console.log("");

    console.log(
        "Reconstruyendo cartera histórica..."
    );


    /*
     * Las fechas se procesan secuencialmente para evitar disparar
     * cientos de solicitudes simultáneas contra Federación.
     *
     * Los endpoints correspondientes a una misma fecha sí pueden
     * consultarse en paralelo porque representan fuentes independientes
     * del mismo feed diario.
     */
    for (
        let indice = 0;
        indice < fechas.length;
        indice++
    ) {

        const fecha =
            fechas.at(indice);

        /*
         * Con noUncheckedIndexedAccess evitamos asumir que el acceso
         * por índice siempre devuelve un elemento.
         */
        if (fecha === undefined) {
            continue;
        }


        console.log(
            `[${indice + 1}/${fechas.length}] ${fecha}`
        );


        const [
            certificados,
            endosos,
            sumas,
            productosDatos,
            riesgosCubiertos,
            componentes,
            clientesFecha
        ] = await Promise.all([

            certificadosService
                .obtenerCertificados(
                    fecha
                ),

            endososService
                .obtenerEndosos(
                    fecha
                ),

            sumasService
                .obtenerCertificadosSumas(
                    fecha
                ),

            productosDatosService
                .obtenerProductosDatos(
                    fecha
                ),

            riesgosCubiertosService
                .obtenerRiesgosCubiertos(
                    fecha
                ),

            componentesService
                .obtenerCertificadosComponentes(
                    fecha
                ),

            clientesService
                .obtenerClientes(
                    fecha
                )

        ]);


        /*
         * Todos los resultados corresponden a la misma fecha y forman
         * una única unidad lógica de procesamiento.
         *
         * Los clientes no forman parte de FedPatFeedDiario porque
         * se mantienen como información de referencia independiente.
         */
        const feed: FedPatFeedDiario = {
            fecha,
            certificados,
            endosos,
            sumas,
            productosDatos,
            riesgosCubiertos,
            componentes
        };


        /*
         * El StateService incorpora los movimientos al estado acumulado.
         *
         * Los registros repetidos se reemplazan utilizando sus claves
         * naturales, evitando duplicaciones durante reprocesamientos.
         */
        stateService.acumularFeed(
            estados,
            feed
        );


        /*
         * Los clientes se acumulan independientemente del estado
         * de las pólizas.
         *
         * Si un mismo cliente aparece nuevamente en una fecha posterior,
         * reemplazamos su versión anterior. Como las fechas se procesan
         * cronológicamente, al finalizar conservamos la información más
         * reciente conocida dentro del período consultado.
         */
        for (
            const cliente of clientesFecha
        ) {

            const claveCliente =
                `${cliente.tipo_asegurado}-${cliente.codigo}`;

            clientes.set(
                claveCliente,
                cliente
            );
        }


        console.log(
            `   Estados acumulados: ${DateUtils.formatearNumero(estados.size)}`
        );

        console.log(
            `   Clientes acumulados: ${DateUtils.formatearNumero(clientes.size)}`
        );
    }


    console.log("");

    console.log(
        "=================================================="
    );

    console.log(
        "CARTERA RECONSTRUIDA"
    );

    console.log(
        "=================================================="
    );

    console.log(
        `Estados acumulados: ${DateUtils.formatearNumero(estados.size)}`
    );

    console.log(
        `Clientes acumulados: ${DateUtils.formatearNumero(clientes.size)}`
    );


    /*
     * El catálogo de productores se consulta una única vez después
     * de reconstruir la cartera.
     *
     * Cada certificado informa codigo_productor, que posteriormente
     * será utilizado por FedPatPolizaContextService para resolver
     * el productor correspondiente.
     */
    console.log("");

    console.log(
        "Obteniendo catálogo de productores..."
    );

    const productores =
        await productoresService.obtenerProductores();

    console.log(
        `Productores obtenidos: ${DateUtils.formatearNumero(productores.length)}`
    );
    


    /*
     * Los catálogos necesarios para interpretar productos-datos
     * se consultan una sola vez.
     *
     * /datos no requiere fecha.
     *
     * /tablas sí requiere una fecha, por lo que utilizamos la fecha
     * final del período que acabamos de reconstruir.
     */
    console.log("");

    console.log(
        "Obteniendo catálogo de datos..."
    );

    const datos =
        await datosService.obtenerDatos();

    console.log(
        `Datos obtenidos: ${DateUtils.formatearNumero(datos.length)}`
    );


    console.log(
        `Obteniendo tablas para ${FECHA_HASTA}...`
    );

    const tablas =
        await tablasService.obtenerTablas(
            FECHA_HASTA
        );

    console.log(
        `Tablas obtenidas: ${DateUtils.formatearNumero(tablas.length)}`
    );


    /*
     * Convertimos una sola vez el Map de clientes a un array.
     *
     * FedPatPolizaContextService trabaja con FedPatCliente[],
     * por lo que evitamos reconstruir el array para cada póliza
     * analizada.
     */
    const clientesDisponibles =
        Array.from(
            clientes.values()
        );


    /*
     * Contadores utilizados exclusivamente para validar el resultado
     * del bootstrap antes de incorporar persistencia.
     */
    let sinRiesgo = 0;
    let conRiesgo = 0;

    let flota = 0;
    let primaAlta = 0;
    let premioAlto = 0;

    let multiplesRiesgos = 0;


    console.log("");

    console.log(
        "=================================================="
    );

    console.log(
        "ANALIZANDO RIESGOS"
    );

    console.log(
        "=================================================="
    );

    console.log("");


    /*
     * Las reglas de negocio se ejecutan una vez reconstruido el estado
     * histórico de todas las pólizas.
     */
    for (
        const estado of estados.values()
    ) {

        const analisis =
            riskEngine.analizar(
                estado,
                datos,
                tablas
            );


        /*
         * Las pólizas sin riesgos no forman parte de nuestra colección
         * normalizada de riesgos.
         */
        if (
            analisis.riesgos.length === 0
        ) {

            sinRiesgo++;

            continue;
        }


        conRiesgo++;

        /*
        * Diagnóstico temporal de los movimientos disponibles para la póliza.
        *
        * Permite analizar cómo factura Federación Patronal las pólizas FLOTA
        * para las cuales FedPatImportesService no pudo resolver actualmente
        * un movimiento de facturación.
        *
        * Los endosos se ordenan únicamente para facilitar la inspección.
        * Este bloque no participa de ninguna decisión de negocio.
        */
        const endososOrdenados = [...estado.endosos]
            .sort((a, b) => a.endoso - b.endoso);

        console.log(
            `\nENDOSOS ${estado.codigoRamo}/${estado.numeroPoliza}`
        );

        for (const endoso of endososOrdenados) {
            console.log(
                `  #${endoso.endoso} | ` +
                `Tipo: ${endoso.tipo_endoso} | ` +
                `Emisión: ${endoso.fecha_emision} | ` +
                `Vigencia: ${endoso.vigencia_desde} -> ${endoso.vigencia_hasta} | ` +
                `Prima: ${endoso.prima}`
            );
        }



        /*
         * A partir de este punto solamente procesamos pólizas que
         * contienen al menos un riesgo de negocio.
         *
         * Primero resolvemos el certificado principal utilizado como
         * cabecera de la póliza normalizada.
         */
        const certificado =
            contextService.obtenerCertificadoPrincipal(
                estado
            );

        if (
            certificado === null
        ) {

            console.warn(
                `⚠ ${estado.codigoRamo}/${estado.numeroPoliza} ` +
                "sin certificado principal"
            );

            continue;
        }

        /*
        * Resolvemos independientemente el movimiento que representa
        * el período de facturación de la póliza.
        *
        * Este movimiento no depende del utilizado por ImportesService
        * para calcular prima o premio anualizados.
        */
        const endosoFacturacion =facturacionService.obtenerEndosoFacturacion(estado);


        /*
         * El productor se relaciona utilizando el código informado
         * en el certificado principal contra el catálogo de FedPat.
         *
         * La ausencia de productor sí impide construir correctamente
         * la póliza normalizada.
         */
        const productor =
            contextService.obtenerProductor(
                certificado,
                productores
            );

        if (
            productor === null
        ) {

            console.warn(
                `⚠ ${estado.codigoRamo}/${estado.numeroPoliza} ` +
                `sin productor ${certificado.codigo_productor}`
            );

            continue;
        }


        /*
         * El cliente se relaciona utilizando tipo_asegurado +
         * codigo_asegurado del certificado principal.
         */
        const cliente =
            contextService.obtenerCliente(
                certificado,
                clientesDisponibles
            );


        /*
         * La ausencia de cliente no invalida la póliza.
         *
         * FedPatPolizaMapper admite cliente null y posteriormente
         * puede utilizar un valor por defecto. Por ahora registramos
         * el caso para validar la calidad del catálogo histórico.
         */
        if (
            cliente === null
        ) {

            console.warn(
                `⚠ ${estado.codigoRamo}/${estado.numeroPoliza} ` +
                `sin cliente ${certificado.tipo_asegurado}/` +
                certificado.codigo_asegurado
            );
        }


        /*
        * Diagnóstico temporal del contexto resuelto y del movimiento
        * de facturación seleccionado para cada póliza con riesgo.
        *
        * endosoFacturacion corresponde exactamente al movimiento utilizado
        * por FedPatImportesService para calcular los importes anualizados.
        *
        * Todavía no construimos Poliza ni escribimos en Firestore.
        */
        console.log(
            `${estado.codigoRamo}/${estado.numeroPoliza} -> ` +
            `${analisis.riesgos.join(", ")} | ` +
            `Productor: ${productor.codigo} - ${productor.nombre} | ` +
            `Cliente: ${cliente?.nombre ?? "SIN INFORMAR"} | ` +
            `Facturación certificado: ${certificado.tipo_facturacion ?? "SIN INFORMAR"} | ` +
            `Cantidad: ${certificado.cant_facturacion ?? "SIN INFORMAR"} | ` +
            `Endoso facturación: ${endosoFacturacion?.endoso ?? "SIN INFORMAR"} | ` +
            `Tipo: ${endosoFacturacion?.tipo_endoso ?? "SIN INFORMAR"} | ` +
            `Período: ${endosoFacturacion?.vigencia_desde ?? "SIN INFORMAR"} -> ` +
            `${endosoFacturacion?.vigencia_hasta ?? "SIN INFORMAR"}`
        );


        if (
            analisis.riesgos.includes(
                TipoRiesgo.FLOTA
            )
        ) {

            flota++;
        }


        if (
            analisis.riesgos.includes(
                TipoRiesgo.PRIMA_ALTA
            )
        ) {

            primaAlta++;
        }


        if (
            analisis.riesgos.includes(
                TipoRiesgo.PREMIO_ALTO
            )
        ) {

            premioAlto++;
        }


        if (
            analisis.riesgos.length > 1
        ) {

            multiplesRiesgos++;
        }
    }


    const duracion =
        Date.now() - inicio;


    console.log("");

    console.log(
        "=================================================="
    );

    console.log(
        "RESULTADO"
    );

    console.log(
        "=================================================="
    );


    console.log(
        `Pólizas procesadas:       ${DateUtils.formatearNumero(estados.size)}`
    );

    console.log(
        `Sin riesgo:               ${DateUtils.formatearNumero(sinRiesgo)}`
    );

    console.log(
        `Con algún riesgo:         ${DateUtils.formatearNumero(conRiesgo)}`
    );


    console.log("");


    console.log(
        `FLOTA:                    ${DateUtils.formatearNumero(flota)}`
    );

    console.log(
        `PRIMA_ALTA:               ${DateUtils.formatearNumero(primaAlta)}`
    );

    console.log(
        `PREMIO_ALTO:              ${DateUtils.formatearNumero(premioAlto)}`
    );

    console.log(
        `Más de un riesgo:         ${DateUtils.formatearNumero(multiplesRiesgos)}`
    );


    console.log("");

    console.log(
        "--------------------------------------------------"
    );

    console.log(
        `PÓLIZAS QUE GUARDARÍAMOS: ${DateUtils.formatearNumero(conRiesgo)}`
    );

    console.log(
        "--------------------------------------------------"
    );


    console.log("");

    console.log(
        `Duración total: ${DateUtils.formatearDuracion(duracion)}`
    );

    console.log(
        "No se realizaron escrituras en Firestore."
    );

}


/**
 * Punto de entrada del proceso.
 *
 * Cualquier error no controlado provoca la finalización del script
 * con código distinto de cero para poder detectarlo posteriormente
 * desde procesos automatizados.
 */
main().catch(
    (error: unknown) => {

        console.error(
            "Error ejecutando sincronización FedPat:",
            error
        );

        process.exit(1);
    }
);