'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarSesion } from '../services/auth' // Importamos el servicio limpio

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [cargando, setCargando] = useState(false)
  
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault() // Evita que la página se recargue al mandar el formulario
    setErrorMsg('')
    setCargando(true)

    try {
      // Usamos nuestra función abstraída en lugar de escribir todo el código de Supabase acá
      await iniciarSesion(email, password)
      
      // Si todo sale bien, lo mandamos al dashboard. El middleware se encargará de dejarlo pasar.
      router.push('/dashboard/transactions')
    } catch (error: any) {
      // Si las credenciales son incorrectas, mostramos el error
      setErrorMsg('Correo o contraseña incorrectos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">TMM - Iniciar Sesión</h1>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="tu@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-end">
            <button 
              type="button"
              onClick={() => alert('Pronto armaremos esta pantalla!')} // Acá pondremos la redirección en el Paso 3
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${cargando ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}