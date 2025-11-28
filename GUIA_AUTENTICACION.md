# Guía de Autenticación y Gestión de Usuarios

## Resumen del Sistema

Tu aplicación ahora está completamente protegida con autenticación. Solo usuarios autorizados pueden acceder al sistema.

## Características Implementadas

### 1. Pantalla de Login Obligatoria
- Todos los usuarios deben iniciar sesión con correo y contraseña
- No existe opción de registro público
- Diseño limpio y profesional que coincide con tu aplicación

### 2. Protección Completa de Rutas
- Todas las páginas están protegidas mediante middleware
- Si un usuario no autenticado intenta acceder, es redirigido automáticamente al login
- Las sesiones son persistentes (cookies seguras)

### 3. Gestión de Sesiones
- Las sesiones se mantienen activas entre recargas
- Botón "Cerrar sesión" disponible en todas las páginas
- Al cerrar sesión, el usuario es redirigido al login

### 4. Panel de Administración de Usuarios
- Accesible solo para administradores en `/admin/users`
- Permite crear nuevos usuarios con email, contraseña y nombre
- Permite eliminar usuarios existentes
- Los usuarios creados por admin no necesitan confirmar email

### 5. Seguridad
- Las contraseñas se almacenan hasheadas (Supabase Auth)
- Tokens JWT seguros para sesiones
- Middleware que valida autenticación en cada petición
- Mensajes de error claros sin exponer detalles técnicos

## Crear el Primer Usuario Administrador

### Opción 1: Desde el Dashboard de Supabase (RECOMENDADO)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Authentication** > **Users**
3. Click en **Add user** > **Create new user**
4. Completa los datos:
   - **Email**: `admin@hospital.com` (o el que prefieras)
   - **Password**: `Admin123!` (o la que prefieras, mínimo 6 caracteres)
   - **Auto Confirm User**: ✅ Activar esta opción
5. Click en **Create user**
6. El usuario quedará creado y podrás iniciar sesión inmediatamente

### Opción 2: Usando la API de Supabase

Si tienes acceso a la service role key, puedes ejecutar:

\`\`\`bash
curl -X POST 'https://TU_PROJECT_REF.supabase.co/auth/v1/admin/users' \
-H "apikey: TU_SERVICE_ROLE_KEY" \
-H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
-H "Content-Type: application/json" \
-d '{
  "email": "admin@hospital.com",
  "password": "Admin123!",
  "email_confirm": true,
  "user_metadata": {
    "role": "admin",
    "nombre": "Administrador"
  }
}'
\`\`\`

## Crear Usuarios Adicionales

Una vez que tengas acceso como administrador:

1. Inicia sesión con tu cuenta de administrador
2. En la página principal, verás el botón **"Gestionar Usuarios"**
3. Click en **"Nuevo Usuario"**
4. Completa el formulario:
   - **Nombre**: Nombre del usuario (opcional)
   - **Correo electrónico**: Email que usará para iniciar sesión
   - **Contraseña**: Mínimo 6 caracteres
5. Click en **"Crear Usuario"**

El nuevo usuario podrá iniciar sesión inmediatamente (no necesita confirmar email).

## Determinar Quién es Administrador

Por defecto, el sistema considera administrador a cualquier usuario cuyo email contenga la palabra "admin". Por ejemplo:
- ✅ `admin@hospital.com` → Es admin
- ✅ `administrador@hospital.com` → Es admin
- ✅ `admin.hospital@example.com` → Es admin
- ❌ `doctor@hospital.com` → NO es admin

### Cambiar la Lógica de Administrador

Si deseas usar otro método para determinar administradores, edita estos archivos:

**app/admin/users/page.tsx** (línea ~32):
\`\`\`typescript
// Cambia esta lógica según tus necesidades
if (user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') {
  setIsAdmin(true);
}
\`\`\`

**app/api/admin/users/route.ts** (líneas ~13, ~30, ~52):
\`\`\`typescript
// Cambia esta lógica en las 3 funciones (GET, POST, DELETE)
if (!user.email?.includes('admin') && user.user_metadata?.role !== 'admin') {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}
\`\`\`

**app/page.tsx** (línea ~34):
\`\`\`typescript
// Cambia esta lógica para mostrar el botón de gestión de usuarios
setIsAdmin(user.email?.includes('admin') || user.user_metadata?.role === 'admin')
\`\`\`

## Eliminar Usuarios

Solo los administradores pueden eliminar usuarios:

1. Ve a **Gestionar Usuarios**
2. En la lista de usuarios, click en el icono de papelera 🗑️
3. Confirma la eliminación

⚠️ **IMPORTANTE**: No puedes eliminar tu propia cuenta mientras estás autenticado con ella.

## Cambiar Contraseñas

Actualmente el sistema no incluye cambio de contraseña desde la UI. Para cambiar una contraseña:

### Opción 1: Desde Supabase Dashboard
1. Ve a **Authentication** > **Users**
2. Click en el usuario
3. Click en **"Reset Password"** o edita directamente

### Opción 2: Eliminar y Recrear Usuario
1. Elimina el usuario actual desde el panel de administración
2. Crea un nuevo usuario con la misma dirección de email y nueva contraseña

## Recuperar Acceso si Pierdes las Credenciales

Si pierdes las credenciales de tu usuario administrador:

1. Ve al Dashboard de Supabase
2. Authentication > Users
3. Busca tu usuario administrador
4. Click en el usuario y usa "Reset Password"
5. O crea un nuevo usuario administrador siguiendo la guía arriba

## Mensajes de Error Comunes

### "Usuario o contraseña incorrectos"
- Verifica que el email esté escrito correctamente
- Verifica que la contraseña sea correcta (distingue mayúsculas/minúsculas)
- Asegúrate de que el usuario exista en el sistema

### "No autorizado" al acceder a /admin/users
- Solo usuarios administradores pueden acceder
- Verifica que tu email contenga "admin" o que tengas el rol de admin configurado

### Session expiró / Redirigido a login inesperadamente
- Las sesiones pueden expirar después de cierto tiempo
- Simplemente vuelve a iniciar sesión

## Arquitectura Técnica

### Archivos Clave

- **middleware.ts**: Protege todas las rutas, valida autenticación
- **app/auth/login/page.tsx**: Página de inicio de sesión
- **app/admin/users/page.tsx**: Panel de gestión de usuarios (solo admins)
- **app/api/admin/users/route.ts**: API para CRUD de usuarios
- **components/logout-button.tsx**: Componente de cerrar sesión
- **lib/supabase/client.ts**: Cliente de Supabase para navegador
- **lib/supabase/server.ts**: Cliente de Supabase para servidor

### Flujo de Autenticación

1. Usuario accede a cualquier URL
2. Middleware intercepta la petición
3. Middleware verifica si hay sesión válida
4. Si NO hay sesión → Redirige a `/auth/login`
5. Si SÍ hay sesión → Permite acceso a la página
6. Usuario inicia sesión → Crea sesión JWT
7. Sesión se almacena en cookies seguras
8. Usuario puede navegar libremente
9. Usuario cierra sesión → Elimina sesión y redirige a login

### Variables de Entorno Necesarias

El sistema usa estas variables de entorno (ya configuradas en tu proyecto):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para operaciones de admin)

## Personalización

### Cambiar Diseño del Login

Edita `app/auth/login/page.tsx` para modificar:
- Colores y estilos
- Logo de la aplicación
- Textos y descripciones

### Agregar Campos Adicionales a Usuarios

Si necesitas más información de usuarios (teléfono, cargo, etc.):

1. Agrégalos en el formulario de creación (`app/admin/users/page.tsx`)
2. Inclúyelos en `user_metadata` al crear el usuario
3. Accede a ellos con `user.user_metadata.campo`

### Deshabilitar Expiración de Sesión

Por defecto Supabase expira sesiones después de 1 hora. Para cambiar:

1. Ve a Supabase Dashboard
2. Authentication > Settings
3. Busca "JWT expiry limit"
4. Aumenta el tiempo según necesites

## Soporte y Problemas

Si encuentras problemas:

1. Revisa los logs del navegador (Console)
2. Verifica que Supabase esté correctamente configurado
3. Confirma que las variables de entorno estén presentes
4. Asegúrate de que el usuario exista en Authentication > Users

---

**Tu aplicación ahora es completamente privada y segura. Solo usuarios autorizados pueden acceder.**
