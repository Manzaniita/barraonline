'use client'

import React from 'react'

interface CategoryTabsProps {
  categories: string[]
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  const allCategories = ['Todos', ...categories]

  return (
    <div className="overflow-x-auto no-scrollbar py-3 px-4">
      <div className="max-w-md mx-auto flex items-center gap-2">
        {allCategories.map((cat) => {
          const isSelected = selectedCategory === cat
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/25 scale-[1.02]'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
