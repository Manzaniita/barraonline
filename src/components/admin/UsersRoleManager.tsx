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
  Edit2,
  Trash2,
  Building2,
  KeyRound,
  X,
  Loader2,
} from 'lucide-react'

export interface AdminUserRow {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  dni: string | null
  role: 'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'
  authProvider: string
  hasPassword: boolean
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  ordersCount: number
  redemptionsCount: number
  createdAt: string
}

export interface AvailableTenantOption {
  id: string
  name: string
  slug: string
}

interface UsersRoleManagerProps {
  tenantSlug?: string
  allowSuperAdminRole?: boolean
  availableTenants?: AvailableTenantOption[]
  isSuperAdmin?: boolean
}

export function UsersRoleManager({
  tenantSlug,
  allowSuperAdminRole = true,
  availableTenants = [],
  isSuperAdmin = true,
}: UsersRoleManagerProps) {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [detectedSuperAdmin, setDetectedSuperAdmin] = useState(isSuperAdmin)

  const effectiveIsSuper = isSuperAdmin || detectedSuperAdmin
  const effectiveAllowSuperRole = allowSuperAdminRole || detectedSuperAdmin

  // Modal para crear nueva cuenta
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'>('BARTENDER')
  const [newTenantId, setNewTenantId] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // Modal para editar usuario
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editDni, setEditDni] = useState('')
  const [editRole, setEditRole] = useState<'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'>('CUSTOMER')
  const [editTenantId, setEditTenantId] = useState<string>('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal para eliminar usuario
  const [deletingUser, setDeletingUser] = useState<AdminUserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        if (data.viewerRole === 'SUPER_ADMIN') {
          setDetectedSuperAdmin(true)
        }
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

  // Abrir modal de edición pre-cargando los datos
  const openEditModal = (u: AdminUserRow) => {
    if (!effectiveIsSuper && u.role === 'SUPER_ADMIN') {
      showToast('Solo SuperAdmin puede editar cuentas de SuperAdmin.', 'error')
      return
    }
    setEditingUser(u)
    setEditName(u.fullName || '')
    setEditEmail(u.email || '')
    setEditPhone(u.phone || '')
    setEditDni(u.dni || '')
    setEditRole(u.role)
    setEditTenantId(u.tenantId || '')
    setEditNewPassword('')
  }

  // Cambio rápido de rol desde el selector en la tabla
  const handleRoleChange = async (
    userId: string,
    newRoleValue: 'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'
  ) => {
    if (!effectiveIsSuper && newRoleValue === 'SUPER_ADMIN') {
      showToast('Solo un SuperAdmin puede otorgar rango de SUPER_ADMIN.', 'error')
      return
    }
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

  // Cambio rápido de boliche asignado desde la tabla (para SuperAdmin)
  const handleTenantAssignChange = async (userId: string, targetTenantId: string) => {
    setUpdatingUserId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tenantId: targetTenantId || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const matchedTenant = availableTenants.find((t) => t.id === targetTenantId)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  tenantId: targetTenantId || null,
                  tenantName: matchedTenant ? matchedTenant.name : null,
                  tenantSlug: matchedTenant ? matchedTenant.slug : null,
                }
              : u
          )
        )
        showToast(
          matchedTenant
            ? `Usuario asignado a ${matchedTenant.name}`
            : 'Usuario configurado como Global / Sin tienda fija'
        )
      } else {
        showToast(data.error || 'No se pudo cambiar la tienda asignada', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setUpdatingUserId(null)
    }
  }

  // Guardar creación de usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPassword) return
    if (!newEmail.trim() && !newPhone.trim() && !newDni.trim()) {
      showToast('Ingresá al menos correo electrónico, teléfono o DNI.', 'error')
      return
    }

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
          tenantId: newTenantId || undefined,
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
        setNewTenantId('')
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

  // Guardar edición completa de usuario
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setSavingEdit(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editName,
          email: editEmail || null,
          phone: editPhone || null,
          dni: editDni || null,
          role: editRole,
          tenantId: editTenantId || null,
          tenantSlug,
          newPassword: editNewPassword.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Usuario ${editName} actualizado con éxito`)
        setEditingUser(null)
        fetchUsers()
      } else {
        showToast(data.error || 'Error al actualizar usuario', 'error')
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  // Confirmar eliminación de usuario
  const handleDeleteUser = async () => {
    if (!deletingUser) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users?userId=${deletingUser.id}${tenantSlug ? `&tenantSlug=${tenantSlug}` : ''}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Cuenta de ${deletingUser.fullName} eliminada correctamente`)
        setDeletingUser(null)
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      } else {
        showToast(data.error || 'Error al eliminar usuario', 'error')
      }
    } catch {
      showToast('Error de conexión al eliminar usuario', 'error')
    } finally {
      setDeleting(false)
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
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.text}</span>
        </div>
      )}

      {/* Banner de permisos para Admin de Club */}
      {!isSuperAdmin && (
        <div className="bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-pink-950/30 border border-purple-800/40 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shrink-0 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-white text-sm">Gestión de Empleados del Boliche (CRUD Completo)</div>
            <div className="text-purple-200/80 mt-0.5">
              Tenés acceso total para crear cuentas, editar datos personales, resetear contraseñas y dar de baja a tus bartenders y cajeros. Por políticas de seguridad, los permisos de Administrador son asignados exclusivamente por SuperAdmin.
            </div>
          </div>
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
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isSuperAdmin ? 'Crear Cuenta / Asignar Rol' : 'Alta de Empleado (Barra)'}</span>
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios y Gestión CRUD Completo */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              {isSuperAdmin ? 'Cuentas Registradas y Permisos de Acceso' : 'Personal y Empleados del Boliche'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSuperAdmin
                ? 'Administrá los datos personales, reseteá contraseñas, asigná boliche y configurá los roles en vivo.'
                : 'Gestioná los accesos de tus bartenders y personal. Modificá claves y asigná roles operativos.'}
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400">{users.length} cuentas registradas</span>
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
                  <th className="py-3.5 px-4 font-semibold">Boliche Asignado</th>
                  <th className="py-3.5 px-4 font-semibold">Actividad</th>
                  <th className="py-3.5 px-4 font-semibold">Rol Asignado</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {users.map((u) => {
                  const isTargetAdmin = u.role === 'CLUB_ADMIN' || u.role === 'SUPER_ADMIN'
                  const isLockedForViewer = !effectiveIsSuper && u.role === 'SUPER_ADMIN'

                  return (
                    <tr key={u.id} className="text-gray-300 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {u.fullName}
                          {isTargetAdmin && (
                            <span className="text-[10px] font-semibold text-pink-400 bg-pink-950/60 px-1.5 py-0.5 rounded border border-pink-800/40">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {u.hasPassword ? '🔑 Clave activa' : 'Sin clave'} • {u.authProvider}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="text-gray-200">{u.email || '-'}</div>
                        <div className="text-gray-400 font-mono">{u.phone || '-'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-purple-300">
                        {u.dni || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {effectiveIsSuper && availableTenants.length > 0 ? (
                          <select
                            disabled={updatingUserId === u.id}
                            value={u.tenantId || ''}
                            onChange={(e) => handleTenantAssignChange(u.id, e.target.value)}
                            className="bg-gray-900 border border-gray-700 hover:border-purple-500/50 text-purple-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="">🌐 Global / Sin tienda</option>
                            {availableTenants.map((t) => (
                              <option key={t.id} value={t.id}>
                                🏪 {t.name} (/{t.slug})
                              </option>
                            ))}
                          </select>
                        ) : u.tenantName ? (
                          <span className="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300 font-medium">
                            {u.tenantName}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Global / Sin boliche</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        <div>Compras: <b className="text-white">{u.ordersCount}</b></div>
                        <div>Canjes: <b className="text-emerald-400">{u.redemptionsCount}</b></div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isLockedForViewer ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 cursor-not-allowed"
                            title="Cuenta de SuperAdmin"
                          >
                            <Lock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>SUPER_ADMIN</span>
                          </div>
                        ) : (
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
                              ⚙️ CLUB_ADMIN (Admin Tienda)
                            </option>
                            {effectiveIsSuper && effectiveAllowSuperRole && (
                              <option value="SUPER_ADMIN" className="bg-gray-900 text-cyan-300">
                                🛡️ SUPER_ADMIN (Plataforma)
                              </option>
                            )}
                          </select>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isLockedForViewer ? (
                          <div className="flex items-center justify-end text-xs text-gray-500 italic gap-1 pr-2">
                            <Lock className="w-3.5 h-3.5 text-gray-500" />
                            <span>SuperAdmin</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg bg-gray-800 hover:bg-purple-950/60 hover:text-purple-300 border border-gray-700/60 text-gray-400 transition-colors cursor-pointer"
                              title="Editar datos del usuario"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                if (!effectiveIsSuper && u.role === 'SUPER_ADMIN') {
                                  showToast('Solo SuperAdmin puede eliminar a un SuperAdmin.', 'error')
                                  return
                                }
                                setDeletingUser(u)
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors cursor-pointer"
                              title="Eliminar usuario definitivamente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CREAR CUENTA NUEVA CON ROL Y BOLICHE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-elevated border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Alta de Cuenta y Asignación de Rol</h3>
                <p className="text-xs text-gray-400">
                  Creá una cuenta para un bartender, encargado o cliente con su clave inicial.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Nombre y Apellido *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: Lucas Gómez"
                    className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    DNI
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={newDni}
                      onChange={(e) => setNewDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="38123456"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="1123456789"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="lucas@boliche.com"
                    className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Contraseña Inicial *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Ej: barra2026"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
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
                    className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BARTENDER">🍸 Bartender (Barra)</option>
                    <option value="CUSTOMER">👤 Cliente / Personal General</option>
                    <option value="CLUB_ADMIN">⚙️ Admin de la Tienda</option>
                    {effectiveIsSuper && effectiveAllowSuperRole && (
                      <option value="SUPER_ADMIN">🛡️ SuperAdmin</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Selector de Boliche asignado */}
              {availableTenants.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Boliche Asignado
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={newTenantId}
                      onChange={(e) => setNewTenantId(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">(Sin Boliche / Global)</option>
                      {availableTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (/{t.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-purple-900/40"
                >
                  {creating ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR USUARIO COMPLETO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-elevated border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-600/30">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Editar Cuenta de Usuario</h3>
                <p className="text-xs text-gray-400">
                  Modificá datos personales, reseteá contraseña o cambiá el boliche asignado.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Nombre y Apellido *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    DNI
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={editDni}
                      onChange={(e) => setEditDni(e.target.value.replace(/\D/g, ''))}
                      placeholder="DNI"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Teléfono"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Rol Asignado
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="CUSTOMER">👤 Cliente / Personal General</option>
                    <option value="BARTENDER">🍸 Bartender (Barra)</option>
                    <option value="CLUB_ADMIN">⚙️ Admin de la Tienda</option>
                    {effectiveIsSuper && effectiveAllowSuperRole && (
                      <option value="SUPER_ADMIN">🛡️ SuperAdmin</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Boliche Asignado
                  </label>
                  <select
                    value={editTenantId}
                    onChange={(e) => setEditTenantId(e.target.value)}
                    className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">(Sin Boliche / Global)</option>
                    {availableTenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (/{t.slug})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-purple-300 uppercase mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Resetear Contraseña (Opcional)
                </label>
                <input
                  type="text"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Dejá vacío para conservar la contraseña actual"
                  className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-900/40 disabled:opacity-50 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN DE USUARIO */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-elevated border border-rose-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-white animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black mb-1">
              ¿Eliminar usuario definitivamente?
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-4">
              Estás a punto de borrar la cuenta de <strong className="text-white">{deletingUser.fullName}</strong> ({deletingUser.email || deletingUser.dni || deletingUser.phone || 'Sin contacto'}).
            </p>
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200 mb-6">
              ⚠️ Esta acción eliminará su acceso y desvinculará sus registros del sistema. Esta acción no se puede deshacer.
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteUser}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 disabled:opacity-50 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
