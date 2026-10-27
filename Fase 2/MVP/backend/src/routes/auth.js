import { Router } from "express";
import { listarCarreras, login, registrar } from "../services/authService.js";

export const authRouter = Router();

function responderError(res, error) {
  if (!error.status) console.error(error);
  res
    .status(error.status ?? 500)
    .json({ error: error.status ? error.message : "Error interno del servidor" });
}

// GET /auth/carreras — público: el registro ocurre antes de tener sesión.
authRouter.get("/carreras", async (req, res) => {
  try {
    res.json(await listarCarreras());
  } catch (error) {
    responderError(res, error);
  }
});

// POST /auth/registro { correo, password, nombres, primer_apellido, segundo_apellido?,
//                       fecha_nacimiento (AAAA-MM-DD), id_carrera, semestre }
authRouter.post("/registro", async (req, res) => {
  try {
    res.status(201).json(await registrar(req.body));
  } catch (error) {
    responderError(res, error);
  }
});

// POST /auth/login { correo, password }
authRouter.post("/login", async (req, res) => {
  try {
    res.json(await login(req.body));
  } catch (error) {
    responderError(res, error);
  }
});