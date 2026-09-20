import nodemailer from "nodemailer";
import path from "path";
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
     * Envía el correo de renovaciones.
     *
     * El Excel se adjunta normalmente y el logo se incluye
     * dentro del correo mediante CID para que pueda ser
     * visualizado por clientes como Gmail.
     *
     * @param params información necesaria para generar el correo.
     */
    async enviar(params: EmailParams): Promise<void> {

        const attachments = [];

        /*
         * Excel con el detalle de las renovaciones.
         */
        if (params.adjunto) {

            attachments.push({
                filename: params.adjunto.nombreArchivo,
                content: params.adjunto.contenido,
                contentType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
        }


        /*
         * Logo utilizado dentro del cuerpo HTML del correo.
         *
         * El CID permite referenciar la imagen desde:
         *
         * src="cid:logo-tecnica"
         */
        attachments.push({
            filename: "mail.png",
            path: path.resolve(process.cwd(), "..", "assets", "logo2.png"),
            cid: "logo-tecnica"
        });


        const asunto = `Renovaciones de Riesgos - ${params.mesRenovacion} - ${params.nombreDestinatario}`;


        /*
         * Utilizamos estilos inline porque son los que tienen
         * mejor compatibilidad con Gmail y otros clientes de correo.
         */
        const html = `
            <div
                style="
                    font-family: Arial, Helvetica, sans-serif;
                    color: #333333;
                    padding: 10px 5px;
                "
            >

                <!-- Nombre de la ejecutiva -->
                <div
                    style="
                        font-size: 20px;
                        font-weight: bold;
                        font-style: italic;
                        color:rgb(51, 101, 36);
                        margin-bottom: 20px;
                    "
                >
                    ${params.nombreDestinatario}
                </div>


                <!-- Mensaje principal -->
                <div
                    style="
                        color:rgb(59, 118, 41);
                        font-size: 15px;
                        line-height: 1.6;
                        margin-left: 42px;
                    "
                >
                    En el adjunto se encuentran detalladas las pólizas
                    que se renovarán durante este
                    <strong>${params.mesRenovacion}</strong>
                    para que las puedas verificar.
                </div>

                <!-- Logo -->
                    <div
                        style="
                            text-align: center;
                            margin-top: 55px;
                            margin-bottom: 45px;
                        "
                    >
                        <img
                            src="cid:logo-tecnica"
                            alt="Técnica y Servicios"
                            width="320"
                            style="
                                display: inline-block;
                                width: 320px;
                                max-width: 320px;
                                height: auto;
                            "
                        />
                    </div>


                    <!-- Aviso automático -->
                    <div
                        style="
                            text-align: center;
                            color: #777777;
                            font-size: 11px;
                            margin-top: 20px;
                        "
                    >
                        No responder. Este aviso fue generado automáticamente.
                    </div>


                ${
                    params.mensaje
                        ? `
                            <div
                                style="
                                    margin-top: 35px;
                                    color: #777777;
                                    font-size: 12px;
                                "
                            >
                                ${params.mensaje}
                            </div>
                        `
                        : ""
                }

            </div>
        `;


        try {

            await this.transporter.sendMail({

                from:
                    `"Técnica y Servicios" <${this.emailUser}>`,

                to: params.destinatario,

                subject: asunto,

                html,

                attachments
            });

        } catch (error) {

            console.error(
                "Error enviando email mediante Nodemailer:",
                error
            );

            throw error;
        }
    }


    /**
     * Verifica que las credenciales necesarias
     * para enviar correos estén configuradas.
     */
    private validarConfiguracion(): void {

        if (!this.emailUser) {
            throw new Error(
                "Falta configurar EMAIL_USER"
            );
        }

        if (!this.emailAppPassword) {
            throw new Error(
                "Falta configurar EMAIL_APP_PASSWORD"
            );
        }
    }
}