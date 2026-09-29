import { FedPatCertificadoEndoso } from "./fedPatCertificadoEndoso";
import { FedPatCertificadoSuma } from "./fedPatCertificadoSuma";
import { FedPatProductoDato } from "./fedPatProductoDato";
import { FedPatRiesgoCubierto } from "./fedPatRiesgoCubierto";
import { FedPatCertificadoComponente } from "./fedPatCertificadoComponente";
import { FedPatCertificado } from "./fetPatCertificado";

/**
 * Representa el estado acumulado conocido de una póliza de
 * Federación Patronal.
 *
 * La API de Cartera funciona como un feed de movimientos por fecha:
 * un certificado que no aparece en una consulta diaria no debe
 * considerarse automáticamente eliminado.
 *
 * Por ese motivo necesitamos acumular los registros recibidos
 * durante el bootstrap y las posteriores sincronizaciones
 * incrementales.
 */
export interface FedPatPolizaState {

    /**
     * Código de ramo de Federación Patronal.
     *
     * Forma parte de la identidad natural de la póliza porque
     * el número de póliza por sí solo no debe asumirse globalmente
     * único entre ramos.
     */
    codigoRamo: number;

    /**
     * Número de póliza informado por Federación Patronal.
     */
    numeroPoliza: number;

    /**
     * Certificados conocidos para esta póliza.
     *
     * En Automotores colectivos hemos comprobado que distintos
     * certificados pueden representar distintos vehículos.
     */
    certificados: FedPatCertificado[];

    /**
     * Movimientos/endosos conocidos de los certificados.
     *
     * Se conservan porque un movimiento posterior puede modificar
     * información previamente recibida.
     */
    endosos: FedPatCertificadoEndoso[];

    /**
     * Información económica agregada recibida desde
     * `/certificados-sumas`.
     *
     * Todavía no se interpreta cuál registro representa el valor
     * económico vigente de la póliza.
     */
    sumas: FedPatCertificadoSuma[];

    /**
     * Datos dinámicos de los bienes asegurados.
     *
     * Esta colección permite posteriormente reconstruir atributos
     * como patente, chasis, marca, modelo y año.
     */
    productosDatos: FedPatProductoDato[];

    /**
     * Coberturas económicas conocidas para los certificados
     * y sus respectivos endosos.
     *
     * Se conservan los movimientos originales sin agregarlos,
     * debido a que pueden existir valores positivos y negativos.
     */
    riesgosCubiertos: FedPatRiesgoCubierto[];

    /**
     * Componentes económicos asociados a certificados/endosos.
     *
     * Al igual que riesgosCubiertos, se mantienen como movimientos
     * crudos hasta conocer la semántica necesaria para consolidarlos.
     */
    componentes: FedPatCertificadoComponente[];

    /**
     * Fecha más reciente del feed de Federación que fue incorporada
     * al estado de esta póliza.
     *
     * Se guarda como string en formato YYYY-MM-DD para evitar
     * conversiones innecesarias durante la sincronización.
     */
    ultimaFechaProcesada: string;
}