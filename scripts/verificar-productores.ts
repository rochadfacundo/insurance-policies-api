import { FirebaseConfig } from "../src/config/firebaseConfig";

/**
 * Verifica la conexión a Firestore y el estado
 * de la colección de productores.
 *
 * Este script realiza únicamente operaciones de lectura.
 */
async function main(): Promise<void> {

  const firestore = FirebaseConfig.getFirestore();

  const proyecto = process.env.FIREBASE_PROJECT_ID;

  console.log("========================================");
  console.log("VERIFICACIÓN DE FIRESTORE");
  console.log("========================================");

  console.log(`Proyecto configurado: ${proyecto}`);
  console.log("Colección: productores");

  const snapshot = await firestore
  .collection("productores")
  .get();

  console.log("");
  console.log(`Documentos encontrados (máximo 5): ${snapshot.size}`);

  if (snapshot.empty) {
    console.log("No se encontraron productores existentes.");
  } else {
    console.log("ATENCIÓN: Ya existen productores.");

    console.table(
      snapshot.docs.map(doc => ({
        id: doc.id,
        nombre: doc.get("nombre") ?? null,
        matricula: doc.get("matricula") ?? null
      }))
    );
  }

  console.log("");
  console.log("Verificación finalizada.");
  console.log("No se realizaron escrituras.");
}

main().catch((error: unknown) => {
  console.error("Error verificando Firestore:", error);
  process.exitCode = 1;
});