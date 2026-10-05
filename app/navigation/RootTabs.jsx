import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import FeedScreen from "../screens/FeedScreen";
import GroupsScreen from "../screens/GroupsScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStack from "./ProfileStack";

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={FeedScreen} options={{ title: "Inicio" }} />
      <Tab.Screen name="Grupos" component={GroupsScreen} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
      <Tab.Screen name="Notificaciones" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}