import { Request, Response } from "express";
import { FirestoreEjecutivaRepository } from "../repositories/firestoreEjecutivaRepository";

const repository = new FirestoreEjecutivaRepository();

export const obtenerEjecutivaPorId = async (
  req: Request,
  res: Response
): Promise<void> => {

  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
    res.status(400).json({
        error: "Debe especificar una ejecutiva válida."
    });
    return;
    }

    if (!id) {
      res.status(400).json({
        error: "Debe especificar una ejecutiva."
      });
      return;
    }

    const ejecutiva = await repository.obtenerPorId(id);

    if (!ejecutiva) {
      res.status(404).json({
        error: "La ejecutiva solicitada no existe."
      });
      return;
    }

    res.status(200).json(ejecutiva);

  } catch (error) {
    console.error("Error obteniendo ejecutiva:", error);

    res.status(500).json({
      error: "No se pudo obtener la ejecutiva."
    });
  }
};