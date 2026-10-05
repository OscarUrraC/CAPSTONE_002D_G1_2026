import { Router } from "express";
import { loginDemo } from "../services/authService.js";

export const authRouter = Router();

// POST /auth/demo-login { cuenta: "estudiante" | "administrador" }
authRouter.post("/demo-login", async (req, res) => {
  const { cuenta } = req.body;

  try {
    const { token, perfil } = await loginDemo(cuenta);
    res.json({ token, perfil });
  } catch (error) {
    res.status(error.status ?? 500).json({ error: error.message });
  }
});