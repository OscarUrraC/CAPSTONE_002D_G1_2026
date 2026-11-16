import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import FeedStack from "./FeedStack";
import GruposStack from "./GruposStack";
import EventosStack from "./EventosStack";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStack from "./ProfileStack";
import AdminStack from "./AdminStack";

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const { perfil } = useAuth();
  // Solo comodidad visual: el permiso real lo impone el backend en cada ruta /admin.
  const esAdmin = perfil?.rol_plataforma === "administrador";

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={FeedStack} options={{ title: "Inicio" }} />
      <Tab.Screen name="Grupos" component={GruposStack} />
      <Tab.Screen name="Eventos" component={EventosStack} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
      <Tab.Screen name="Notificaciones" component={NotificationsScreen} />
      {esAdmin && <Tab.Screen name="Moderacion" component={AdminStack} options={{ title: "Moderación" }} />}
    </Tab.Navigator>
  );
}