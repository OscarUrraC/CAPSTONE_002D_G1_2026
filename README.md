CAPSTONE 002D – Grupo 1 · Connectboard

Repositorio del proyecto semestral de la asignatura Capstone (PTY4614), Duoc UC, sede San Andrés. Contiene la documentación de cada fase y el código del producto que desarrollamos: Connectboard.

El proyecto

Connectboard es una aplicación móvil de comunidad universitaria para estudiantes de Duoc UC sede San Andrés. Su misión es generar comunidad y un entorno de interacción moderado dentro de la universidad, y facilitar la participación estudiantil mediante recordatorios de eventos y un tablón de anuncios.

Funcionalidades del MVP:

Registro e inicio de sesión con correo institucional @duocuc.cl, perfil con apodo opcional.
Grupos de interés (crear, explorar, unirse, roles de moderador y colaborador).
Feeds "Para Ti" y "Anuncios", publicaciones con fotos, "me gusta" y comentarios en hilos.
Eventos con recordatorios push (1 día antes, 3 horas antes y al inicio).
Moderación: reportes, filtro automático de texto e imágenes (OpenAI Moderation) con cola de revisión, sanciones, umbrales configurables e informe PDF.
Equipo
Integrante	Rol en el proyecto
Matías Colomer	Product Owner · autenticación, moderación y base de datos
Oscar Urra	Scrum Master · grupos
Javier Sanhueza	Feeds · eventos y notificaciones
Estructura del repositorio
text
.
├── Fase 1/                     Definición del proyecto
│   ├── Evidencias Grupales/    Formativa, guía de la fase, planilla y presentación
│   └── Evidencias Individuales/  Autoevaluaciones y diarios de reflexión
└── Fase 2/                     Desarrollo del proyecto
    ├── Evidencias Grupales/    Informe final, guía de desarrollo y planillas de evaluación
    ├── Evidencias Individuales/  Diarios de reflexión
    ├── Evidencias Proyecto/    Backlog, historias de usuario, épicas, sprints y modelo relacional
    └── MVP/                    Código del producto
        ├── app/                App móvil (React Native + Expo)
        ├── backend/            API REST (Node.js + Express)
        ├── database/           Scripts SQL: esquema y datos iniciales
        └── docker-compose.yml  Ejecución del backend con Docker
Arquitectura
text
App Android ──HTTPS/JSON──▶ Backend (Express, en Docker) ──▶ Supabase (PostgreSQL, Auth, Storage)
                                   │
                                   ├──▶ OpenAI Moderation API (texto e imágenes)
                                   └──▶ Expo Push API ──▶ Firebase Cloud Messaging ──▶ teléfono
Capa	Tecnología
App	React Native, Expo SDK 57, React Navigation
Backend	Node.js 22, Express, JWT propio
Base de datos y archivos	Supabase (PostgreSQL con RLS, Storage)
Despliegue	Docker y Docker Compose
Servicios externos	OpenAI Moderation API, Expo Push, Firebase Cloud Messaging

El detalle (modelo de datos, diagramas UML y componentes) está en el Documento de Diseño.

Cómo levantar el sistema

El procedimiento completo, con variables de entorno, configuración de Firebase y solución de problemas, está en el Manual Técnico y de Despliegue. Este es el resumen.

Requisitos: Git, Docker con Compose v2, Node.js 22 o superior, una cuenta de Supabase, una clave de API de OpenAI, una cuenta de Expo y un teléfono Android.

Base de datos. Crear un proyecto vacío en Supabase y ejecutar, en este orden, desde el SQL Editor: Fase 2/MVP/database/01_schema.sql y Fase 2/MVP/database/02_seed.sql.
Variables del backend. Desde Fase 2/MVP:
bash
cp backend/.env.example backend/.env

Completar backend/.env con la URL y las claves de Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY), OPENAI_API_KEY y un JWT_SECRET aleatorio. 3. Backend.

bash
docker compose up -d --build

Comprobación: GET http://localhost:3000/auth/carreras debe responder con la lista de carreras. 4. App. En Fase 2/MVP/app, crear .env a partir de .env.example con EXPO_PUBLIC_API_URL apuntando al backend, instalar la compilación de desarrollo en el teléfono y ejecutar:

bash
npm install
npx expo start --dev-client -c
Primer administrador. Registrar un usuario desde la app y asignarle el rol en Supabase:
sql
update perfil set rol_plataforma = 'administrador' where correo = 'correo@duocuc.cl';

Claves y secretos. Los archivos .env y las claves de Supabase, OpenAI y Firebase no se suben al repositorio. Cada persona que despliegue el sistema debe usar las suyas. La clave service_role de Supabase solo va en el .env del backend.

Documentación
Documento	Ubicación
Informe Final del Proyecto APT	Fase 2/Evidencias Grupales/
Product Backlog, historias de usuario, épicas y sprints	Fase 2/Evidencias Proyecto/
Modelo relacional	Fase 2/Evidencias Proyecto/Modelo Relacional.png
Esquema SQL y datos iniciales	Fase 2/MVP/database/
Limitaciones conocidas
El registro exige un correo @duocuc.cl, pero no verifica que la persona sea la dueña del correo.
Solo se desarrolló y probó la versión Android.
Las notificaciones push se envían solo para recordatorios de eventos.
El backend debe ejecutarse en una sola instancia (cada instancia corre su propio planificador de recordatorios).
Una compilación independiente de Android exige que el backend use HTTPS; el MVP se demuestra con la compilación de desarrollo.
