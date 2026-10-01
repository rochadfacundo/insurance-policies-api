import { FedPatCliente } from "../models/fedPatCliente";
import { FedPatPolizaState } from "../models/fedPatPolizaState";
import { FedPatProductor } from "../models/fedPatProductor";
import { FedPatCertificado } from "../models/fetPatCertificado";

/**
 * Servicio responsable de seleccionar y preparar la información
 * necesaria para construir el contexto de una póliza de Federación
 * Patronal.
 *
 * Esta capa concentra decisiones de selección sobre el estado
 * reconstruido de una póliza antes de enviarlo al mapper común.
 *
 * No transforma información al modelo Poliza ni ejecuta reglas
 * de detección de riesgos.
 */
export class FedPatPolizaContextService {

    /**
     * Obtiene el certificado utilizado como cabecera de la póliza.
     *
     * Actualmente Federación Patronal representa la información
     * general de la póliza mediante el certificado 0, mientras que
     * otros certificados pueden representar riesgos individuales
     * asociados a la misma póliza.
     *
     * @param estado Estado acumulado conocido de la póliza.
     * @returns Certificado 0 o null cuando no está disponible.
     */
    obtenerCertificadoPrincipal(estado: FedPatPolizaState): FedPatCertificado | null {

        return estado.certificados.find(certificado => certificado.certificado === 0) ?? null;
    }

    /**
     * Busca el productor asociado al certificado principal de la póliza.
     *
     * La relación se realiza utilizando el código interno de productor
     * informado por Federación Patronal en `codigo_productor`.
     *
     * No utilizamos matrícula para esta relación, ya que la identidad
     * operativa dentro de la cartera de FedPat está dada por su código
     * de productor.
     *
     * @param certificado Certificado principal de la póliza.
     * @param productores Catálogo de productores obtenido desde FedPat.
     * @returns Productor correspondiente o null cuando no puede resolverse.
     */
    obtenerProductor(certificado: FedPatCertificado,productores: FedPatProductor[]): FedPatProductor | null {

        return productores.find(productor =>productor.codigo === certificado.codigo_productor) ?? null;
    }


   /**
     * Busca el cliente asociado al asegurado informado
     * en el certificado principal de la póliza.
     *
     * La relación se realiza utilizando conjuntamente:
     *
     * - `tipo_asegurado` del certificado contra `tipo_asegurado` del cliente.
     * - `codigo_asegurado` del certificado contra `codigo` del cliente.
     *
     * Se utilizan ambos campos para respetar la identidad informada
     * por Federación Patronal y evitar relacionar clientes únicamente
     * por su código.
     *
     * @param certificado Certificado principal de la póliza.
     * @param clientes Clientes acumulados desde los feeds históricos.
     * @returns Cliente correspondiente o null cuando no puede resolverse.
     */
    obtenerCliente(certificado: FedPatCertificado, clientes: FedPatCliente[]): FedPatCliente | null {

        return clientes.find(cliente => 
            cliente.tipo_asegurado === certificado.tipo_asegurado 
            && 
            cliente.codigo === certificado.codigo_asegurado) ?? null;
    }

}