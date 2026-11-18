import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import CommunityIntroScreen from "../screens/CommunityIntroScreen";

const Stack = createNativeStackNavigator();

export default function PerfilStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="VerPerfil" component={ProfileScreen} options={{ title: "Perfil" }} />
      <Stack.Screen name="EditarPerfil" component={EditProfileScreen} options={{ title: "Editar perfil" }} />
      <Stack.Screen name="DetallePublicacion" component={PostDetailScreen} options={{ title: "Publicación" }} />
      <Stack.Screen name="Normas" component={CommunityIntroScreen} options={{ title: "Normas de la comunidad" }} />
    </Stack.Navigator>
  );
}