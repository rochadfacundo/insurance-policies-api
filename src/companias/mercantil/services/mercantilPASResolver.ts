import { PAS } from "../../../models/pas";
import { Productor } from "../../../models/productor";

export class MercantilPASResolver {

    private static readonly ASEGURADORA_ID = "mercantil-andina";

    private readonly indiceCodigos = new Map<string, PAS[]>();

    private readonly indiceMatriculas = new Map<string, PAS[]>();

    constructor(productoresPAS: PAS[]) {

        this.construirIndices(productoresPAS);
    }

    /**
     * Resuelve el identificador interno del PAS asociado
     * a un productor de Mercantil.
     *
     * Retorna null cuando la asociación no es concluyente.
     */
    resolver(productor: Productor): string | null {

        const codigo = String(productor.codigo);

        const matricula = productor.matricula != null
            ? String(productor.matricula)
            : null;

        const coincidenciasCodigo =
            this.indiceCodigos.get(codigo) ?? [];

        // No existe un único PAS asociado al código.
        if (coincidenciasCodigo.length !== 1) {
            return null;
        }

        const pas = coincidenciasCodigo[0];

        // No asociar automáticamente productores no activos.
        if (pas === undefined || pas.estado !== "ACTIVO") {
            return null;
        }

        const matriculaPAS = pas.matricula?.trim() || null;

        // Las matrículas informadas son contradictorias.
        if (
            matricula !== null &&
            matriculaPAS !== null &&
            matricula !== matriculaPAS
        ) {
            return null;
        }

        if (matricula !== null) {

            const coincidenciasMatricula =
                this.indiceMatriculas.get(matricula) ?? [];

            // La matrícula corresponde también a otro PAS.
            const existeOtroPAS =
                coincidenciasMatricula.some(
                    candidato => candidato.id !== pas.id
                );

            if (existeOtroPAS) {
                return null;
            }
        }

        const registrosCodigo = pas.companias.filter(
            compania =>
                compania.aseguradoraId ===
                    MercantilPASResolver.ASEGURADORA_ID &&
                compania.codigos.some(
                    valor => valor.trim() === codigo
                )
        );

        // Solo asociamos códigos propios.
        if (
            registrosCodigo.length === 0 ||
            registrosCodigo.some(
                compania => compania.estado !== "PROPIO"
            )
        ) {
            return null;
        }

        return pas.id;
    }

    /**
     * Construye los índices de búsqueda una sola vez,
     * evitando recorrer todos los PAS por cada productor.
     */
    private construirIndices(productoresPAS: PAS[]): void {

        for (const pas of productoresPAS) {

            const matricula = pas.matricula?.trim();

            if (matricula) {

                this.agregarAlIndice(
                    this.indiceMatriculas,
                    matricula,
                    pas
                );
            }

            const companiasMercantil = pas.companias.filter(
                compania =>
                    compania.aseguradoraId ===
                    MercantilPASResolver.ASEGURADORA_ID
            );

            for (const compania of companiasMercantil) {

                for (const valor of compania.codigos) {

                    const codigo = valor.trim();

                    if (!codigo) {
                        continue;
                    }

                    this.agregarAlIndice(
                        this.indiceCodigos,
                        codigo,
                        pas
                    );
                }
            }
        }
    }

    /**
     * Incorpora un PAS al índice evitando duplicaciones
     * del mismo documento.
     */
    private agregarAlIndice(
        indice: Map<string, PAS[]>,
        clave: string,
        pas: PAS
    ): void {

        const registros = indice.get(clave) ?? [];

        const existe = registros.some(
            registro => registro.id === pas.id
        );

        if (!existe) {

            registros.push(pas);

            indice.set(clave, registros);
        }
    }
}