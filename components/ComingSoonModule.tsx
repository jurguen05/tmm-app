import Link from 'next/link'

interface ComingSoonModuleProps {
  icon: string
  iconColorClass?: string
  title: string
  description: string
  badgeText?: string
  backHref?: string
  backLabel?: string
}

export function ComingSoonModule({
  icon,
  iconColorClass = 'bg-indigo-50 text-indigo-600',
  title,
  description,
  badgeText = 'Coming Soon',
  backHref = '/dashboard',
  backLabel = 'Back to Dashboard',
}: ComingSoonModuleProps) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-3xl ${iconColorClass}`}>
          {icon}
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {badgeText}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-gray-500 max-w-lg mx-auto text-sm">{description}</p>
        </div>

        <div className="pt-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{backLabel}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
