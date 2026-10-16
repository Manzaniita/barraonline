'use client'

import React, { useState, useMemo } from 'react'
import { TenantWithCatalog } from '@/lib/catalog-service'
import { CartProvider } from '@/context/CartContext'
import { StoreHeader } from './StoreHeader'
import { InAppBrowserBanner } from './InAppBrowserBanner'
import { CategoryTabs } from './CategoryTabs'
import { ProductCard } from './ProductCard'
import { FloatingCartBar } from './FloatingCartBar'
import { CartDrawer } from './CartDrawer'
import { Search } from 'lucide-react'

interface StoreFrontViewProps {
  tenant: TenantWithCatalog
}

export function StoreFrontView({ tenant }: StoreFrontViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Extraer categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>()
    tenant.products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [tenant.products])

  // Filtrar productos por categoría y término de búsqueda
  const filteredProducts = useMemo(() => {
    return tenant.products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'Todos' || product.category === selectedCategory

      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description &&
          product.description.toLowerCase().includes(searchQuery.toLowerCase()))

      return matchesCategory && matchesSearch
    })
  }, [tenant.products, selectedCategory, searchQuery])

  return (
    <CartProvider tenantSlug={tenant.slug}>
      <div
        className="min-h-screen bg-[#0a0a0c] text-white flex flex-col selection:bg-purple-500 selection:text-white"
        style={
          {
            '--tenant-primary': tenant.themeConfig.primaryColor,
            '--tenant-secondary': tenant.themeConfig.secondaryColor,
          } as React.CSSProperties
        }
      >
        {/* Banner de detección de navegador in-app (Instagram / TikTok) */}
        <InAppBrowserBanner />

        {/* Cabecera Móvil White-Label */}
        <StoreHeader theme={tenant.themeConfig} tenantSlug={tenant.slug} />

        <main className="flex-1 pb-28">
          {/* Buscador Rápido de Bebidas */}
          <div className="px-4 pt-3 pb-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar fernet, gin, cerveza..."
                className="w-full bg-[#14141c] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Selector de Categorías */}
          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Grilla / Lista de Productos */}
          <div className="px-4 max-w-md mx-auto space-y-3 pt-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <p className="text-sm">No encontramos tragos para tu búsqueda.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('Todos')
                    setSearchQuery('')
                  }}
                  className="mt-2 text-xs text-purple-400 font-semibold underline"
                >
                  Ver toda la carta
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </main>

        {/* Barra Flotante Inferior de Carrito */}
        <FloatingCartBar />

        {/* Panel Desplegable de Carrito y Checkout */}
        <CartDrawer
          tenantSlug={tenant.slug}
          nightclubName={tenant.themeConfig.nightclubName}
        />
      </div>
    </CartProvider>
  )
}
