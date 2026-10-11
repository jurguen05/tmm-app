// services/queries.ts
import { supabase } from '../lib/supabase'
import { Transaction, Strategy, Profile } from '../types'

// 1. Obtener el perfil del usuario actual
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    
  if (error) {
    console.error("Error cargando perfil:", error.message)
    return null
  }
  return data
}

// 2. Obtener todas las transacciones
export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    
  if (error) throw new Error(error.message)
  return data || []
}

// 3. Obtener las estrategias activas
export async function getActiveStrategies(): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('is_active', true)
    .order('name')
    
  if (error) throw new Error(error.message)
  return data || []
}

// 4. Actualizar un solo campo de una transacción
export async function updateTransactionField(id: string, field: string, value: any): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ [field]: value })
    .eq('id', id)
    
  if (error) throw new Error(error.message)
}

// 5. Borrar transacciones masivamente
export async function deleteTransactions(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids)
    
  if (error) throw new Error(error.message)
}

export const getPositions = async () => {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .order('symbol', { ascending: true }); // Ordenamos alfabéticamente por Ticker

  if (error) throw error;
  return data || [];
}