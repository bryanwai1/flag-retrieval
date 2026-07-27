/**
 * AITB — AI tool buttons. Every app name on an activity is looked up in
 * AITB_APPS; names with a url render as a real link that opens the tool in a
 * new browser tab, names without one fall back to a plain pill so an unknown
 * tool name can never break a screen.
 *
 * Sign-in hints (e.g. "Sign in with your Google account") are collected across
 * the whole set and shown once underneath, instead of repeating on every button.
 */
import { aitbApp, aitbAppNotes } from '../lib/aitbActivities'

type Size = 'sm' | 'lg'

export function AitbAppLinks({ apps, color, size = 'sm' }: {
  apps: string[]
  color: string
  size?: Size
}) {
  const notes = aitbAppNotes(apps)
  const lg = size === 'lg'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {apps.map(name => {
          const app = aitbApp(name)
          const common = {
            background: `${color}22`,
            color,
            border: `1.5px solid ${color}55`,
          }
          if (!app) {
            return (
              <span key={name}
                className={`rounded-full font-bold ${lg ? 'px-5 py-2 text-xl' : 'px-3 py-1.5 text-sm'}`}
                style={common}>
                {name}
              </span>
            )
          }
          return (
            <a key={name} href={app.url} target="_blank" rel="noopener noreferrer"
              title={`Open ${name} in a new tab`}
              className={`rounded-2xl font-bold transition-all active:scale-95 hover:scale-[1.03] flex flex-col ${lg ? 'px-5 py-2.5' : 'px-3 py-2'}`}
              style={common}>
              <span className={`flex items-center gap-1.5 ${lg ? 'text-xl' : 'text-sm'}`}>
                {name} <span className="opacity-60">↗</span>
              </span>
              {app.sub && (
                <span className={`font-bold opacity-70 ${lg ? 'text-sm' : 'text-[10px]'}`}>{app.sub}</span>
              )}
            </a>
          )
        })}
      </div>
      {notes.length > 0 && (
        <div className={`text-gray-400 font-bold mt-2 ${lg ? 'text-base' : 'text-xs'}`}>
          {notes.map(n => `🔑 ${n}`).join(' · ')}
        </div>
      )}
    </div>
  )
}
