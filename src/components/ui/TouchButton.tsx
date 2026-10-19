// src/components/ui/TouchButton.tsx
'use client'

import React from 'react'
import { clsx } from 'clsx'

export interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function TouchButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  ...props
}: TouchButtonProps) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold select-none cursor-pointer overflow-hidden transition-all duration-200 ease-[var(--ease-spring-out)] active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none'

  const sizeStyles = {
    sm: 'min-h-[40px] px-3.5 text-xs rounded-xl gap-1.5',
    md: 'min-h-[48px] px-5 text-sm rounded-2xl gap-2',
    lg: 'min-h-[56px] px-6 text-base rounded-2xl gap-2.5',
  }[size]

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_auto] hover:bg-[position:right_center] text-white shadow-lg shadow-purple-900/30 border border-white/20',
    glass: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md',
    danger: 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30',
  }[variant]

  return (
    <button className={clsx(baseStyles, sizeStyles, variantStyles, className)} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
