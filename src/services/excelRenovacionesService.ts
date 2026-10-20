import ExcelJS from "exceljs";
import { Poliza } from "../models/poliza";
import { RenovacionesService } from "./renovacionesService";
import { ECompania } from "../models/eCompania";

export class ExcelRenovacionesService {

    private readonly nombreHoja = "Renovaciones";
    private readonly creador = "Técnica y Servicios";

    private readonly renovacionesService = new RenovacionesService();

    async generarExcel(polizas: Poliza[]): Promise<Buffer> {

        const workbook = new ExcelJS.Workbook();

        workbook.creator = this.creador;
        workbook.created = new Date();
        workbook.properties.date1904 = false;

        const worksheet = workbook.addWorksheet(this.nombreHoja);

        worksheet.columns = [
            {
                header: "Compañía",
                key: "compania",
                width: 22
            },
            {
                header: "Código PAS",
                key: "codigoProductor",
                width: 14
            },
            {
                header: "Productor",
                key: "productor",
                width: 30
            },
            {
                header: "Póliza",
                key: "poliza",
                width: 18
            },
            {
                header: "Asegurado",
                key: "asegurado",
                width: 35
            },
            {
                header: "Próxima gestión",
                key: "fechaGestion",
                width: 20
            },
            {
                header: "Tipo de gestión",
                key: "tipoGestion",
                width: 24
            }
        ];

        for (const poliza of polizas) {

            worksheet.addRow({
                compania: poliza.compania,
                codigoProductor: poliza.productor.codigo,
                productor: poliza.productor.nombre,
                poliza: poliza.detallePoliza.numeroPoliza,
                asegurado: poliza.cliente?.nombre ?? "-",
                fechaGestion: this.obtenerFechaGestion(poliza),
                tipoGestion: this.obtenerTipoGestion(poliza)
            });
        }

        this.aplicarFormato(worksheet);

        const buffer = await workbook.xlsx.writeBuffer();

        return Buffer.from(buffer);
    }

        
    /**
     * Obtiene la fecha de próxima gestión y normaliza
     * sus componentes de calendario utilizando UTC.
     *
     * De esta manera, Excel muestra el mismo día
     * que Angular.
     */
    private obtenerFechaGestion(poliza: Poliza): Date | string {

        const fecha = this.renovacionesService.obtenerFechaProximaGestion(poliza);

        if (!fecha) {
            return "-";
        }

        return new Date(Date.UTC(
            fecha.getUTCFullYear(),
            fecha.getUTCMonth(),
            fecha.getUTCDate()
        ));
    }


    /**
     * Determina el tipo de gestión.
     *
     * Federación Patronal dispone de un tipo explícito.
     * Para Mercantil y RUS se utiliza el período
     * de facturación.
     */
    private obtenerTipoGestion(poliza: Poliza): string {

        if (poliza.compania === ECompania.FEDERACION_PATRONAL) {

            switch (poliza.tipoProximaGestion) {

                case "RENOVACION":
                    return "Renovación";

                case "REFACTURACION":
                    return "Refacturación";

                default:
                    return "No determinada";
            }
        }

        return "Gestión de facturación";
    }

    /**
     * Aplica formato a la planilla.
     */
    private aplicarFormato(worksheet: ExcelJS.Worksheet): void {

        const header = worksheet.getRow(1);

        header.font = {
            bold: true,
            size: 12
        };

        header.alignment = {
            horizontal: "center",
            vertical: "middle"
        };

        header.height = 22;

        worksheet.views = [
            {
                state: "frozen",
                ySplit: 1
            }
        ];

        worksheet.autoFilter = {
            from: "A1",
            to: "G1"
        };

        worksheet.eachRow((row, rowNumber) => {

            row.alignment = {
                vertical: "middle"
            };

            if (rowNumber > 1) {

                const celdaFecha = row.getCell("fechaGestion");

                if (celdaFecha.value instanceof Date) {
                    celdaFecha.numFmt = "dd/mm/yyyy";
                }
            }
        });
    }
}
