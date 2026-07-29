import { useNavigate } from 'react-router-dom'
import { useBingoAuth } from '../hooks/useBingoAuth'
import { FacilitatorSessions } from '../components/FacilitatorSessions'

/**
 * Crew page — `/bingo-dash/crew`.
 *
 * The trainer-lead equivalent of the owner's Accounts page, cut down to the one
 * thing a lead needs: issuing their own crew passes so helpers can facilitate
 * THEIR event without a sign-up or an approval from the main account holder.
 *
 * Everything else on the Accounts page (approving renters, the shared template,
 * the client sign-up link) stays owner-only — a lead never sees another
 * tenant's accounts here, and the database enforces that independently.
 */
export function BingoDashCrew() {
  const navigate = useNavigate()
  const { account, isFacilitator, isOwner } = useBingoAuth()

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-purple-400 text-xs font-black uppercase tracking-[0.3em]">Bingo Dash</p>
            <h1 className="text-white text-4xl font-black tracking-tight mt-1">My crew</h1>
          </div>
          <button onClick={() => navigate('/bingo-dash/admin')}
            className="px-4 py-2 rounded-2xl text-white/80 font-bold text-sm border border-white/20 hover:bg-white/10 transition-colors">
            ← Admin
          </button>
        </div>

        {isFacilitator ? (
          // A facilitator has no tenant of its own, so it has no boards to
          // invite anyone onto — create_facilitator_session refuses this too.
          <div className="px-4 py-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="text-4xl mb-3">🎪</div>
            <p className="text-white font-bold">You're on someone else's crew</p>
            <p className="text-gray-400 text-sm mt-1">
              You're helping {account?.display_name ? <b className="text-gray-300">{account.display_name}</b> : 'an organiser'} run their
              event, so there's no crew of your own to invite. Ask the organiser if you need more helpers added.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <FacilitatorSessions />
            {isOwner && (
              <button onClick={() => navigate('/bingo-dash/accounts')}
                className="text-sm text-gray-500 hover:text-white transition-colors text-left">
                Looking for approvals and the client sign-up link? → Accounts
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
