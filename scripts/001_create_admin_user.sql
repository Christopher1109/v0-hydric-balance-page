-- Script para crear el primer usuario administrador
-- IMPORTANTE: Ejecutar este script SOLO UNA VEZ después de implementar la autenticación

-- Este script crea un usuario administrador inicial
-- Cambia estos valores por tus credenciales deseadas:
-- Email: admin@hospital.com
-- Password: Admin123!

-- NOTA: Este script debe ejecutarse desde el Dashboard de Supabase SQL Editor
-- o usando la herramienta de administración de Supabase

-- Para crear el usuario administrador, ve a:
-- 1. Dashboard de Supabase
-- 2. Authentication > Users
-- 3. Click en "Add user" > "Create new user"
-- 4. Email: admin@hospital.com
-- 5. Password: Admin123! (o la que prefieras)
-- 6. Auto Confirm User: YES (activar)
-- 7. Click "Create user"

-- Alternativamente, puedes usar el siguiente comando si tienes acceso a la API de administración:
-- (Este script es solo documentación, no se ejecuta automáticamente)

/*
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/auth/v1/admin/users' \
-H "apikey: YOUR_SERVICE_ROLE_KEY" \
-H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
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
*/

-- Verificar que el usuario se creó correctamente
-- SELECT id, email, created_at FROM auth.users WHERE email = 'admin@hospital.com';
