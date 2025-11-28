# Instrucciones para Primer Uso del Sistema de Autenticación

## ¡IMPORTANTE! Lee esto ANTES de usar la aplicación

Tu aplicación ahora requiere autenticación. Debes crear un usuario administrador ANTES de poder usarla.

## Pasos para Comenzar

### 1. Crear el Primer Usuario Administrador

#### Método Simple (Recomendado): Dashboard de Supabase

1. Abre tu navegador y ve a: https://app.supabase.com
2. Inicia sesión con tu cuenta de Supabase
3. Selecciona tu proyecto de Balance Hídrico
4. En el menú lateral izquierdo, click en **"Authentication"**
5. Click en la pestaña **"Users"**
6. Click en el botón verde **"Add user"** (arriba a la derecha)
7. Selecciona **"Create new user"**
8. Completa el formulario:
   \`\`\`
   Email: admin@hospital.com
   Password: Admin123!
   \`\`\`
9. **MUY IMPORTANTE**: Activa la opción **"Auto Confirm User"** ✅
10. Click en **"Create user"**

¡Listo! Ya tienes tu primer usuario administrador.

### 2. Iniciar Sesión por Primera Vez

1. Abre tu aplicación de Balance Hídrico
2. Verás la pantalla de login automáticamente
3. Ingresa las credenciales que creaste:
   - Email: `admin@hospital.com`
   - Password: `Admin123!`
4. Click en **"Iniciar sesión"**

### 3. Crear Usuarios Adicionales

Una vez dentro de la aplicación:

1. En la página principal, verás un botón **"Gestionar Usuarios"**
2. Click en ese botón
3. Click en **"Nuevo Usuario"**
4. Completa:
   - **Nombre**: Nombre del médico/enfermera (opcional)
   - **Correo electrónico**: Email que usará para login
   - **Contraseña**: Mínimo 6 caracteres
5. Click en **"Crear Usuario"**

El nuevo usuario podrá iniciar sesión inmediatamente.

## Credenciales Recomendadas para Inicio

### Usuario Administrador Principal
- **Email**: admin@hospital.com
- **Password**: Admin123! (cámbiala después del primer login)
- **Rol**: Administrador (puede gestionar otros usuarios)

### Usuarios del Personal
Crea usuarios para cada persona que necesite acceso:
- **Ejemplo 1**: doctor.perez@hospital.com
- **Ejemplo 2**: enfermera.garcia@hospital.com
- **Ejemplo 3**: jefe.turno@hospital.com

## ¿Quién es Administrador?

Por defecto, cualquier usuario cuyo email contenga "admin" es considerado administrador.

**Administradores** ✅:
- admin@hospital.com
- administrador@hospital.com
- admin.sistema@hospital.com

**Usuarios normales** (sin privilegios especiales):
- doctor@hospital.com
- enfermera@hospital.com
- usuario@hospital.com

## ¿Qué Puede Hacer Cada Tipo de Usuario?

### Administradores
- Ver y gestionar pacientes
- Agregar ingresos y egresos
- Crear nuevos usuarios del sistema
- Eliminar usuarios existentes
- Cerrar sesión

### Usuarios Normales
- Ver y gestionar pacientes
- Agregar ingresos y egresos
- Cerrar sesión

## Cerrar Sesión

En cualquier página, verás un botón **"Cerrar sesión"** en la esquina superior derecha. Al hacer click, serás redirigido al login.

## Problemas Comunes

### No puedo crear el usuario administrador en Supabase

**Solución**:
1. Verifica que estés en el proyecto correcto
2. Asegúrate de activar "Auto Confirm User"
3. Si el email ya existe, elimínalo primero desde Users

### No puedo iniciar sesión

**Solución**:
1. Verifica que el email sea exactamente como lo creaste (minúsculas/mayúsculas importan)
2. Verifica que la contraseña sea correcta
3. Asegúrate de haber activado "Auto Confirm User" al crear el usuario

### No veo el botón "Gestionar Usuarios"

**Solución**:
- Solo los administradores ven este botón
- Verifica que tu email contenga la palabra "admin"
- Si no la contiene, crea un nuevo usuario con email que incluya "admin"

### Olvidé mi contraseña

**Solución**:
1. Ve al Dashboard de Supabase
2. Authentication > Users
3. Busca tu usuario
4. Click en el usuario y selecciona "Reset Password"
5. O elimina y recrea el usuario

## Seguridad

- ✅ Las contraseñas se almacenan hasheadas (encriptadas)
- ✅ Las sesiones usan tokens JWT seguros
- ✅ No existe registro público
- ✅ Solo tú puedes crear usuarios
- ✅ Todas las páginas están protegidas

## Siguientes Pasos

1. ✅ Crear usuario administrador
2. ✅ Iniciar sesión
3. ✅ Crear usuarios para tu equipo médico
4. ✅ Comenzar a usar la aplicación normalmente

---

**¡Tu aplicación está ahora completamente protegida y lista para usar!**

Si necesitas ayuda, revisa el archivo GUIA_AUTENTICACION.md para más detalles técnicos.
