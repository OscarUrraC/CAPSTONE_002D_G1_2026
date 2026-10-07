## Descripción del proyecto
ConnectBoard es una plataforma para estudiantes de un instituto universitario.
Los estudiantes crean y participan en grupos de interés, académicos o de
promoción/emprendimiento, con una
dinámica similar a los subreddits.

### Roles
- **Estudiante (usuario):** crea grupos, se une/sale, publica posts (mensajes),
  reporta publicaciones o grupos.
- **Moderador de grupo:** es el creador del grupo. Gestiona el grupo y sus
  posts, y puede nombrar colaboradores.
- **Colaborador:** tiene las mismas facultades que el moderador, excepto
  otorgar rangos (no puede nombrar ni quitar colaboradores).
- **Administrador de la plataforma:** resuelve los reportes. Puede aplicar
  sanciones, baneos, o escalar el caso a la institución en casos graves.

### Seguridad y moderación
- Los usuarios pueden reportar posts o grupos.
- Los administradores resuelven los reportes (sanción, baneo, escalamiento).
- Existen dos flujos de inicio de sesión: usuario y administrador. Los permisos
  deben validarse en el backend según el rol, nunca solo en el front.
- Aún NO existe un dashboard de moderación para administradores.


## Principio de trazabilidad (OBLIGATORIO)
- Nunca hacer DELETE físico de datos de negocio (grupos, membresías,
  publicaciones, comentarios, reportes, sanciones). Usar cambios de estado.
- Todo cambio de estado debe registrar quién (id_perfil_actor), cuándo y,
  cuando aplique, el motivo.
- Los cambios de membresía se registran además en grupo_miembro_evento.
- Salir de un grupo = estado 'abandonado'. Expulsar = 'expulsado'.

## Reglas de grupos
- Si grupo.ingreso_limitado = true, debe un colaborador o administrador del grupo debe permitir el acceso al usuario
- Un grupo con ingreso_limitado solo es visible/accesible para sus miembros
  activos (y para administradores de la plataforma).
- Un miembro 'expulsado' no puede volver a unirse por sí mismo.
- RLS está activado en todas las tablas sin políticas; todo acceso a datos
  pasa por el backend con service_role. Por eso el backend valida rol y
  membresía en cada endpoint.