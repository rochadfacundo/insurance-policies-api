import {
    MercantilPoliza,
    MercantilPolizasResponse
} from "../models/mercantilModelPolizas";

import { MercantilPolizasManager }
from "../models/mercantilPolizasManager";

import { obtenerPolizasVigentes }
from "./mercantilPolizasService";

/**
 * Servicio encargado de reconstruir
 * la cartera completa de Mercantil.
 *
 * Responsabilidades:
 * - Consultar todas las páginas.
 * - Acumular pólizas.
 * - Eliminar duplicados.
 * - Construir un MercantilPolizasManager.
 *
 * NO contiene lógica de negocio.
 * La lógica vive en MercantilPolizasManager.
 */
export class MercantilCarteraService {

    private readonly pageSize: number;

    constructor(
        pageSize: number = 100
    ) {
        this.pageSize = pageSize;
    }

    /**
     * Obtiene toda la cartera
     * de un productor.
     */
    async obtenerCarteraCompleta(
        productor: number
    ): Promise<MercantilPolizasManager> {

        let offset = 0;

        let total = 0;

        const polizas: MercantilPoliza[] = [];

        do {

            console.log(
                `Consultando offset ${offset}...`
            );

            const response =
                await obtenerPolizasVigentes(
                    productor,
                    this.pageSize,
                    offset
                );

            total = response.total;

            polizas.push(
                ...response.polizas
            );

            offset += this.pageSize;

        } while (offset < total);

        const polizasSinDuplicados =
            this.eliminarDuplicados(
                polizas
            );

        const responseCompleta: MercantilPolizasResponse = {

            productor,

            offset: 0,

            limit:
                polizasSinDuplicados.length,

            total:
                polizasSinDuplicados.length,

            polizas:
                polizasSinDuplicados
        };

        return new MercantilPolizasManager(
            responseCompleta
        );
    }

    /**
     * Elimina pólizas duplicadas.
     */
    private eliminarDuplicados(
        polizas: MercantilPoliza[]
    ): MercantilPoliza[] {

        const map =
            new Map<
                number,
                MercantilPoliza
            >();

        for (const poliza of polizas) {

            map.set(
                poliza.poliza,
                poliza
            );
        }

        return Array.from(
            map.values()
        );
    }
}