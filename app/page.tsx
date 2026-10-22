'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarSesion } from '../services/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [cargando, setCargando] = useState(false)
  
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setCargando(true)

    try {
      await iniciarSesion(email, password)
      router.push('/dashboard')
    } catch {
      setErrorMsg('Invalid email or password.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white text-2xl font-bold shadow-lg shadow-indigo-600/30 mb-3">
            T
          </span>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">TMM - Sign In</h1>
          <p className="text-xs text-gray-500 mt-1">Portfolio & Investment Management Platform</p>
        </div>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-end">
            <button 
              type="button"
              onClick={() => alert('Password reset is coming soon!')}
              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              Forgot your password?
            </button>
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            className={`w-full py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/20 text-sm font-bold text-white cursor-pointer transition-all ${cargando ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {cargando ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Access to TMM is strictly <span className="font-semibold text-gray-700">by invitation only</span>.
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            If you received an onboarding invitation, please open your private link.
          </p>
        </div>
      </div>
    </div>
  )
}
