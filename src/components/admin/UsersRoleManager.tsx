'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Search,
  UserPlus,
  ShieldCheck,
  Wine,
  User,
  Settings,
  Mail,
  Phone,
  IdCard,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

interface AdminUserRow {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  dni: string | null
  role: 'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'
  authProvider: string
  hasPassword: boolean
  tenantName: string | null
  tenantSlug: string | null
  ordersCount: number
  redemptionsCount: number
  createdAt: string
}

interface UsersRoleManagerProps {
  tenantSlug?: string
  allowSuperAdminRole?: boolean
}

export function UsersRoleManager({
  tenantSlug = 'demo-club',
  allowSuperAdminRole = true,
}: UsersRoleManagerProps) {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  // Modal para crear nueva cuenta desde el Admin
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'>('BARTENDER')
  const [creating, setCreating] = useState(false)

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (tenantSlug) q.set('tenantSlug', tenantSlug)
      if (search.trim()) q.set('search', search.trim())

      const res = await fetch(`/api/admin/users?${q.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.users) {
        setUsers(data.users)
      } else {
        showToast(data.error || 'Error cargando usuarios', 'error')
      }
    } catch {
      showToast('Error de conexión al cargar usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, search])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleChange = async (
    userId: string,
    newRoleValue: 'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'
  ) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: newRoleValue,
          tenantSlug,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRoleValue } : u))
        )
        showToast(`Rol actualizado a ${newRoleValue}`)
      } else {
        showToast(data.error || 'No se pudo cambiar el rol', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPassword) return

    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName,
          email: newEmail || undefined,
          phone: newPhone || undefined,
          dni: newDni || undefined,
          password: newPassword,
          role: newRole,
          tenantSlug,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Cuenta de ${newName} creada con rol ${newRole}`)
        setShowCreateModal(false)
        setNewName('')
        setNewEmail('')
        setNewPhone('')
        setNewDni('')
        setNewPassword('')
        fetchUsers()
      } else {
        showToast(data.error || 'Error al crear usuario', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setCreating(false)
    }
  }

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
      case 'CLUB_ADMIN':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/40'
      case 'BARTENDER':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700'
    }
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{toast.text}</span>
        </div>
      )}

      {/* Barra Superior de Búsqueda y Alta de Usuario */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, correo, DNI o teléfono..."
            className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Cuenta / Asignar Personal</span>
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios y Asignación de Rol */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Cuentas Registradas y Permisos de Acceso
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Cambiá el rol de cualquier cuenta para habilitarle el acceso a la Barra (Bartender) o al Panel Admin.
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400">{users.length} cuentas</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No se encontraron usuarios con ese criterio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider bg-gray-950/40">
                  <th className="py-3.5 px-4 font-semibold">Usuario</th>
                  <th className="py-3.5 px-4 font-semibold">Contacto (Correo / Tel)</th>
                  <th className="py-3.5 px-4 font-semibold">DNI</th>
                  <th className="py-3.5 px-4 font-semibold">Método</th>
                  <th className="py-3.5 px-4 font-semibold">Actividad</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Asignar Rol en Vivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="text-gray-300 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{u.fullName}</div>
                      <div className="text-[11px] text-gray-500">
                        {u.hasPassword ? '🔑 Con contraseña activa' : 'Sin clave definida'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-gray-200">{u.email || '-'}</div>
                      <div className="text-gray-400 font-mono">{u.phone || '-'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-purple-300">
                      {u.dni || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-xs uppercase font-mono text-gray-400">
                      {u.authProvider}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      <div>Compras: <b className="text-white">{u.ordersCount}</b></div>
                      <div>Canjes: <b className="text-emerald-400">{u.redemptionsCount}</b></div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <select
                        disabled={updatingUserId === u.id}
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(
                            u.id,
                            e.target.value as
                              | 'CUSTOMER'
                              | 'BARTENDER'
                              | 'CLUB_ADMIN'
                              | 'SUPER_ADMIN'
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer transition-colors ${getRoleBadgeStyle(
                          u.role
                        )}`}
                      >
                        <option value="CUSTOMER" className="bg-gray-900 text-white">
                          👤 CUSTOMER (Cliente)
                        </option>
                        <option value="BARTENDER" className="bg-gray-900 text-purple-300">
                          🍸 BARTENDER (Barra)
                        </option>
                        <option value="CLUB_ADMIN" className="bg-gray-900 text-pink-300">
                          ⚙️ CLUB_ADMIN (Dueño/Encargado)
                        </option>
                        {allowSuperAdminRole && (
                          <option value="SUPER_ADMIN" className="bg-gray-900 text-cyan-300">
                            🛡️ SUPER_ADMIN (Plataforma)
                          </option>
                        )}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR NUEVA CUENTA CON ROL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-black text-white mb-1">
              Alta de Cuenta y Asignación de Rol
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Creá una cuenta para un bartender, encargado o cliente con su clave inicial.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Nombre y Apellido *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: Lucas Gómez"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    DNI
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={newDni}
                      onChange={(e) => setNewDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="38123456"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="1123456789"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="lucas@boliche.com"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Contraseña Inicial *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ej: barra2026"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Rol Asignado *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BARTENDER">Bartender (Barra)</option>
                    <option value="CLUB_ADMIN">Admin del Boliche</option>
                    <option value="CUSTOMER">Cliente</option>
                    {allowSuperAdminRole && (
                      <option value="SUPER_ADMIN">SuperAdmin</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
