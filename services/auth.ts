// services/auth.ts
import { supabase } from '../lib/supabase';

// 1. Iniciar Sesión
export async function iniciarSesion(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw new Error(error.message);
  return data;
}

// 2. Cerrar Sesión
export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// 3. Solicitar Recuperación de Contraseña
export async function enviarCorreoRecuperacion(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw new Error(error.message);
}
