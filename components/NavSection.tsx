'use client'

import React from 'react'

interface NavSectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  hasActiveChild?: boolean
  children: React.ReactNode
}

export default function NavSection({
  title,
  isOpen,
  onToggle,
  hasActiveChild = false,
  children,
}: NavSectionProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition-colors group cursor-pointer select-none rounded hover:bg-gray-800/50"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {!isOpen && hasActiveChild && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
              title="Active page inside"
            />
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-gray-200 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {isOpen && (
        <div className="space-y-1 pt-0.5 transition-all duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
