import { Productor } from "../../../models/productor";
import { PolizaCartera } from "../../../models/polizaCartera";

import { MercantilCarteraService } from "./mercantilCarteraService";
import { MercantilPASResolver } from "./mercantilPASResolver";

import { MercantilPolizaCarteraMapper } from "../mapper/mercantilPolizaCarteraMapper";

export class MercantilCarteraSyncService {

    constructor(
        private readonly pasResolver: MercantilPASResolver,

        private readonly mercantilService =
            new MercantilCarteraService()
    ) {}

    /**
     * Obtiene y transforma la cartera completa de un
     * productor de Mercantil.
     *
     * No realiza escrituras en Firestore.
     *
     * Si alguna póliza no puede procesarse, la
     * sincronización se considera incompleta.
     */
    async sincronizar(
        productor: Productor
    ): Promise<PolizaCartera[]> {

        const resultado: PolizaCartera[] = [];

        let polizasConError = 0;

        // ==========================================
        // 1. RESOLVER ASOCIACIÓN CON PAS
        // ==========================================

        const pasId = this.pasResolver.resolver(productor);

        // ==========================================
        // 2. OBTENER CARTERA COMPLETA
        // ==========================================

        const cartera =
            await this.mercantilService.obtenerCarteraCompleta(
                productor.codigo
            );

        const polizas = cartera.getPolizas();

        console.log(
            `[MERCANTIL CARTERA] Productor ${productor.codigo} - ` +
            `${productor.nombre} - ${polizas.length} pólizas`
        );

        console.log(
            `[MERCANTIL CARTERA] PAS asociado: ${pasId ?? "SIN ASOCIAR"}`
        );

        // ==========================================
        // 3. PROCESAR PÓLIZAS
        // ==========================================

        for (const polizaMercantil of polizas) {

            try {

                const numeroPoliza = polizaMercantil.poliza;

                const endoso = polizaMercantil.endoso;

                // Verificar que la póliza corresponda
                // al código comercial consultado.
                if (
                    polizaMercantil.productor !== productor.codigo
                ) {

                    throw new Error(
                        `Código de productor contradictorio. ` +
                        `Consultado: ${productor.codigo}. ` +
                        `Informado: ${polizaMercantil.productor}.`
                    );
                }

                // ======================================
                // 3.1. DETALLE ACTUAL
                // ======================================

                const detalleActual =
                    await this.mercantilService.obtenerDetallePoliza(
                        numeroPoliza,
                        endoso
                    );

                // ======================================
                // 3.2. INFORMACIÓN ECONÓMICA
                // ======================================

                const analisis =
                    await this.mercantilService.analizarFacturacionCartera(
                        numeroPoliza,
                        endoso,
                        detalleActual
                    );

                // ======================================
                // 3.3. MAPEAR PÓLIZA
                // ======================================

                const poliza =
                    MercantilPolizaCarteraMapper.mapear(
                        polizaMercantil,
                        detalleActual,
                        analisis.detalleFacturacion,
                        productor,
                        pasId,
                        analisis.periodicidadFacturacion,
                        analisis.historialRestringido
                    );

                resultado.push(poliza);

            } catch (error: unknown) {

                polizasConError++;

                const mensaje = error instanceof Error
                    ? error.message
                    : String(error);

                console.error(
                    `[MERCANTIL CARTERA] Error procesando ` +
                    `póliza ${polizaMercantil.poliza}, ` +
                    `endoso ${polizaMercantil.endoso}: ${mensaje}`
                );
            }
        }

        // ==========================================
        // 4. VALIDAR SINCRONIZACIÓN
        // ==========================================

        console.log(
            `[MERCANTIL CARTERA] Resultado productor ${productor.codigo}:`,
            {
                recibidas: polizas.length,
                procesadas: resultado.length,
                errores: polizasConError
            }
        );

        if (polizasConError > 0) {

            throw new Error(
                `[MERCANTIL CARTERA] Sincronización incompleta ` +
                `del productor ${productor.codigo}. ` +
                `${polizasConError} pólizas no pudieron procesarse.`
            );
        }

        return resultado;
    }
}