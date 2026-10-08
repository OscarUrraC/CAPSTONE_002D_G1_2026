import { API_URL } from "../config";
import { File } from "expo-file-system/next";

export async function loginDemo(cuenta) {
  const respuesta = await fetch(`${API_URL}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuenta }),
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al iniciar sesión");
  }
  return data; // { token, perfil }
}

export async function obtenerPerfil(token) {
  const respuesta = await fetch(`${API_URL}/perfil/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al obtener el perfil");
  }
  return data;
}

// PATCH /perfil/me { apodo, mostrar_apodo }
export async function actualizarPerfil(token, cambios) {
  const respuesta = await fetch(`${API_URL}/perfil/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cambios),
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al actualizar el perfil");
  }
  return data;
}

export async function subirFotoPerfil(token, imagenUri) {
  const formData = new FormData();
  formData.append("foto", new File(imagenUri));

  const respuesta = await fetch(`${API_URL}/perfil/me/foto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error ?? "Error al subir la foto");
  }
  return data;
}