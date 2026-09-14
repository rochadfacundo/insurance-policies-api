import ExcelJS from "exceljs";

import { Poliza } from "../models/poliza";


export class ExcelRenovacionesService {

    private nombreHoja = "Renovaciones";
    private creador = "Técnica y Servicios";


    async generarExcel(polizas: Poliza[]): Promise<Buffer> {

        const workbook = new ExcelJS.Workbook();

        workbook.creator = this.creador;
        workbook.created = new Date();

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
                header: "Vencimiento",
                key: "vencimiento",
                width: 16
            }
        ];


        for (const poliza of polizas) {

            worksheet.addRow({
                compania: poliza.compania,
                codigoProductor: poliza.productor.codigo,
                productor: poliza.productor.nombre,
                poliza: poliza.detallePoliza.numeroPoliza,
                asegurado: poliza.cliente?.nombre ?? "-",
                vencimiento: this.obtenerFechaVencimiento(poliza)
            });
        }


        this.aplicarFormato(worksheet);


        const buffer = await workbook.xlsx.writeBuffer();


        return Buffer.from(buffer);
    }


    private obtenerFechaVencimiento(poliza: Poliza): Date | string {

        const fecha = poliza.vigencia?.hasta;

        if (!fecha) {
            return "-";
        }

        if (fecha instanceof Date) {
            return fecha;
        }

        return String(fecha);
    }


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
            to: "F1"
        };


        worksheet.eachRow(
            (
                row,
                rowNumber
            ) => {

                row.alignment = {
                    vertical: "middle"
                };

                if (rowNumber > 1) {

                    const celdaVencimiento = row.getCell("vencimiento");

                    if (celdaVencimiento.value instanceof Date) {
                        celdaVencimiento.numFmt = "dd/mm/yyyy";
                    }
                }
            }
        );
    }
}