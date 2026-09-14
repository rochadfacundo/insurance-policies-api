export interface EmailParams {
    destinatario: string;
    nombreDestinatario: string;
    mesRenovacion: string;
    cantidadPolizas: number;
    mensaje: string;
    adjunto?: {
        nombreArchivo: string;
        contenido: Buffer;
    };
}