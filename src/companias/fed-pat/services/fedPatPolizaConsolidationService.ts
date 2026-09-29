import { FedPatPolizaState } from "../models/fedPatPolizaState";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";
import { FedPatProductoDato } from "../models/fedPatProductoDato";
import { FedPatCertificado } from "../models/fetPatCertificado";


/**
 * Representa el estado consolidado conocido de un certificado
 * dentro de una póliza de Federación Patronal.
 *
 * Esta estructura todavía conserva modelos propios de Federación.
 * Su objetivo es seleccionar la información relevante antes de
 * transformarla al modelo común `Poliza`.
 */
export interface FedPatCertificadoConsolidado {

    certificado: FedPatCertificado;

    /**
     * Último endoso conocido para este certificado.
     *
     * Puede ser null cuando todavía no recibimos información
     * desde `/certificados-endosos`.
     */
    ultimoEndoso: FedPatCertificadoEndoso | null;

    /**
     * Información económica conocida para el certificado.
     *
     * `/certificados-sumas` no posee número de endoso, por lo que
     * actualmente mantenemos una única suma conocida por certificado.
     */
    suma: FedPatCertificadoSuma | null;

    /**
     * Datos dinámicos correspondientes al último endoso conocido
     * del certificado.
     *
     * Estos registros posteriormente podrán transformarse en un
     * vehículo mediante FedPatProductoDatosMapper y FedPatVehiculoMapper.
     */
    productosDatos: FedPatProductoDato[];
}


/**
 * Servicio encargado de interpretar un FedPatPolizaState acumulado
 * y obtener el estado conocido más reciente de sus certificados.
 *
 * No determina todavía:
 * - si una póliza está vigente;
 * - si un certificado fue dado de baja;
 * - si certificado 0 es cabecera;
 * - si existe una flota;
 * - qué riesgos debe generar la póliza.
 *
 * Su única responsabilidad es consolidar temporalmente la información
 * que ya conocemos.
 */
export class FedPatPolizaConsolidationService {

    /**
     * Consolida todos los certificados conocidos de una póliza.
     */
    consolidar(
        estado: FedPatPolizaState
    ): FedPatCertificadoConsolidado[] {

        return estado.certificados.map(
            certificado =>
                this.consolidarCertificado(
                    estado,
                    certificado
                )
        );
    }


    /**
     * Construye el estado consolidado de un certificado individual.
     */
    private consolidarCertificado(
        estado: FedPatPolizaState,
        certificado: FedPatCertificado
    ): FedPatCertificadoConsolidado {

        const ultimoEndoso =
            this.obtenerUltimoEndoso(
                estado,
                certificado.certificado
            );

        const suma =
            this.obtenerSuma(
                estado,
                certificado.certificado
            );

        const productosDatos =
            this.obtenerProductosDatos(
                estado,
                certificado.certificado,
                ultimoEndoso
            );

        return {
            certificado,
            ultimoEndoso,
            suma,
            productosDatos
        };
    }


    /**
     * Obtiene el endoso con mayor número conocido para un certificado.
     *
     * IMPORTANTE:
     * por ahora utilizamos el número de endoso como criterio temporal.
     * Esta regla se probará con información real antes de utilizarla
     * para generar pólizas definitivas.
     */
    private obtenerUltimoEndoso(
        estado: FedPatPolizaState,
        numeroCertificado: number
    ): FedPatCertificadoEndoso | null {

        const endosos =
            estado.endosos.filter(
                endoso =>
                    endoso.certificado === numeroCertificado
            );

        if (endosos.length === 0) {
            return null;
        }

        return endosos.reduce(
            (ultimo, actual) =>
                actual.endoso > ultimo.endoso
                    ? actual
                    : ultimo
        );
    }


    /**
     * Recupera la información económica conocida del certificado.
     *
     * El StateService ya garantiza una única entrada por:
     *
     * ramo + póliza + certificado
     */
    private obtenerSuma(
        estado: FedPatPolizaState,
        numeroCertificado: number
    ): FedPatCertificadoSuma | null {

        return (
            estado.sumas.find(
                suma =>
                    suma.certificado === numeroCertificado
            ) ??
            null
        );
    }


    /**
     * Obtiene los datos dinámicos asociados al último endoso conocido.
     *
     * Si todavía no conocemos un endoso para el certificado,
     * no intentamos mezclar arbitrariamente datos pertenecientes
     * a distintos movimientos.
     */
    private obtenerProductosDatos(
        estado: FedPatPolizaState,
        numeroCertificado: number,
        ultimoEndoso: FedPatCertificadoEndoso | null
    ): FedPatProductoDato[] {

        if (ultimoEndoso === null) {
            return [];
        }

        return estado.productosDatos.filter(
            dato =>
                dato.certificado === numeroCertificado &&
                dato.endoso === ultimoEndoso.endoso
        );
    }
}