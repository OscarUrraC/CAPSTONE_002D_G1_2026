import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import FeedStack from "./FeedStack";
import GruposStack from "./GruposStack";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStack from "./ProfileStack";

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={FeedStack} options={{ title: "Inicio" }} />
      <Tab.Screen name="Grupos" component={GruposStack} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
      <Tab.Screen name="Notificaciones" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}