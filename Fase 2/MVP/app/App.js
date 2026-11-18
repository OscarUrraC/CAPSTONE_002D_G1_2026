import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthStack from "./navigation/AuthStack";
import RootTabs from "./navigation/RootTabs";
import CommunityIntroScreen from "./screens/CommunityIntroScreen";

function Contenido() {
  const { token, perfil, verificandoSesion, introPendiente, completarIntroduccion } = useAuth();

  if (verificandoSesion) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token || !perfil) {
    return <AuthStack />;
  }

  if (introPendiente) {
    return <CommunityIntroScreen onContinuar={completarIntroduccion} />;
  }

  return <RootTabs />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Contenido />
      </NavigationContainer>
    </AuthProvider>
  );
}