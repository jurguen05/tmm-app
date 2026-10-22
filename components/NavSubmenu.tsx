'use client'

import React from 'react'
import Link from 'next/link'

export interface NavSubmenuItem {
  label: string
  href: string
  dotColor?: string
}

interface NavSubmenuProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  isActive: boolean
  mainHref?: string
  items: NavSubmenuItem[]
  currentPathname: string
}

export default function NavSubmenu({
  title,
  icon,
  isExpanded,
  onToggle,
  isActive,
  mainHref,
  items,
  currentPathname,
}: NavSubmenuProps) {
  const isDirectActive = mainHref ? currentPathname === mainHref : false

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between rounded-lg transition-colors ${
          isDirectActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : isActive
            ? 'bg-gray-800/80 text-white'
            : 'hover:bg-gray-800/60 text-gray-300'
        }`}
      >
        {mainHref ? (
          <Link
            href={mainHref}
            onClick={() => {
              if (!isExpanded) onToggle()
            }}
            className="flex-1 px-3 py-2 flex items-center gap-2.5 text-sm font-medium rounded-l-lg hover:text-white transition-colors"
          >
            {icon}
            <span>{title}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 px-3 py-2 flex items-center gap-2.5 text-sm font-medium rounded-l-lg hover:text-white transition-colors text-left cursor-pointer"
          >
            {icon}
            <span>{title}</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={`p-2 rounded-r-lg hover:bg-black/20 transition-colors cursor-pointer ${
            isDirectActive || isActive ? 'text-white' : 'text-gray-400 hover:text-white'
          }`}
          title={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Sub-item tree */}
      {isExpanded && (
        <div className="relative pl-4 ml-3 border-l-2 border-gray-700/60 space-y-1 mt-1 transition-all">
          {items.map((item) => {
            const isItemActive = currentPathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isItemActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.dotColor || 'bg-indigo-400'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
