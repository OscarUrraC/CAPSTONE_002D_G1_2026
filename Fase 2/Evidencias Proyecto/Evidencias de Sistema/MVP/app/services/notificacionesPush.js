import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registrarDispositivo, eliminarDispositivo } from "./api";

// Con la app abierta, Android no muestra avisos por defecto: este handler los muestra.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Devuelve el token de Expo de este celular, o null si no hay permiso.
// pedirPermiso=false evita mostrar el diálogo (se usa al cerrar sesión).
async function obtenerPushToken(pedirPermiso) {
  // En Android 13+ el canal debe existir antes de pedir permiso o token.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Recordatorios",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && pedirPermiso) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Falta extra.eas.projectId en app.json");

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

// Registra este celular para el usuario de la sesión. Nunca lanza: un fallo de push no debe romper el login.
export async function registrarPush(authToken) {
  try {
    const pushToken = await obtenerPushToken(true);
    if (!pushToken) return null;
    await registrarDispositivo(authToken, pushToken, Platform.OS);
    return pushToken;
  } catch (e) {
    console.warn("push: no se pudo registrar el dispositivo:", e.message);
    return null;
  }
}

// Quita este celular del usuario al cerrar sesión. Nunca lanza.
export async function desregistrarPush(authToken) {
  try {
    const pushToken = await obtenerPushToken(false);
    if (pushToken) await eliminarDispositivo(authToken, pushToken);
  } catch (e) {
    console.warn("push: no se pudo desregistrar el dispositivo:", e.message);
  }
}