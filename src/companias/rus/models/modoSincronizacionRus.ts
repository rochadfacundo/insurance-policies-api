
/**
 * Sincronización de RUS. Puede ser BOOTSTRAP o INCREMENTAL.
 * SI es BOOTSTRAP, significa que se está realizando una sincronización completa de todos los datos.
 * SI es INCREMENTAL, significa que se está realizando una sincronización de los datos que han cambiado desde la última sincronización.
 */
export enum ModoSincronizacionRus {
    BOOTSTRAP = "BOOTSTRAP",
    INCREMENTAL = "INCREMENTAL"
}

