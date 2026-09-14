import nodemailer from "nodemailer";
import { EmailParams } from "../models/emailParams";


export class EmailService {

    private readonly emailUser: string;
    private readonly emailAppPassword: string;
    private readonly transporter;

    constructor() {

        this.emailUser = process.env.EMAIL_USER ?? "";

        this.emailAppPassword = process.env.EMAIL_APP_PASSWORD ?? "";

        this.validarConfiguracion();

        this.transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: this.emailUser,
                    pass: this.emailAppPassword
                }
            });
    }


    /**
     * Envía un correo electrónico utilizando Gmail
     * mediante Nodemailer.
     *
     * @param params información necesaria para generar el correo.
     */
    async enviar(params: EmailParams): Promise<void> {

        const attachments = [];

        if (params.adjunto) {

            attachments.push({
                filename: params.adjunto.nombreArchivo,

                content: params.adjunto.contenido,

                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
        }


        const asunto =`Renovaciones de Riesgos - ${params.mesRenovacion}`;


        const html = `
            <div style="font-family: Arial, sans-serif; color: #333;">

                <h3>
                    Hola ${params.nombreDestinatario},
                </h3>

                <p>
                    Te compartimos las pólizas de los productores
                    a tu cargo que tienen vencimiento durante
                    <strong>${params.mesRenovacion}</strong>.
                </p>

                <p>
                    <strong>
                        ${params.cantidadPolizas}
                        pólizas próximas a renovar
                    </strong>
                </p>

                <p>
                    ${params.mensaje}
                </p>

                <p>
                    Este aviso fue generado automáticamente
                    por el sistema de Técnica y Servicios.
                </p>

                <p>
                    <strong>Técnica y Servicios</strong>
                </p>

            </div>
        `;


        try {

            await this.transporter.sendMail({

                from: `"Técnica y Servicios" <${this.emailUser}>`,
                to: params.destinatario,
                subject: asunto,
                html,
                attachments
            });

        } catch (error) {

            console.error("Error enviando email mediante Nodemailer:",error);

            throw error;
        }
    }


    /**
     * Verifica que las credenciales necesarias
     * para enviar correos estén configuradas.
     */
    private validarConfiguracion(): void {

        if (!this.emailUser) {
            throw new Error("Falta configurar EMAIL_USER");
        }

        if (!this.emailAppPassword) {
            throw new Error("Falta configurar EMAIL_APP_PASSWORD");
        }
    }
}