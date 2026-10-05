import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";

const Stack = createNativeStackNavigator();

export default function PerfilStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="VerPerfil" component={ProfileScreen} options={{ title: "Perfil" }} />
      <Stack.Screen name="EditarPerfil" component={EditProfileScreen} options={{ title: "Editar perfil" }} />
    </Stack.Navigator>
  );
}