-- Los formularios guardaban "" en lugar de NULL. Como clients.email es UNIQUE,
-- el primer cliente sin email ocupaba el valor "" y cualquier otro cliente sin
-- email fallaba al editarse (unique_violation 23505).
UPDATE public.clients SET email = NULL WHERE email = '';
UPDATE public.clients SET telefono = NULL WHERE telefono = '';
UPDATE public.clients SET direccion = NULL WHERE direccion = '';
UPDATE public.clients SET departamento = NULL WHERE departamento = '';
