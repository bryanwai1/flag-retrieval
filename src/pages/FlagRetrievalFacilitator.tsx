import { useState } from 'react'
import { ParticleBackground } from '../components/ParticleBackground'

const ORANGE_ANSWERS = [
  { qty: 4,    item: 'Visa card' },
  { qty: 3,    item: 'Waist belt' },
  { qty: 5,    item: 'Grey hair' },
  { qty: 1,    item: 'Lipstick' },
  { qty: 1,    item: 'Physical photo of a loved one' },
  { qty: null, item: 'Malaysia bank note with at least one "8" in the number' },
  { qty: null, item: "Tie a coconut hair to one member's hair" },
]

const GREEN_ANSWERS = [
  { item: 'Red shoe' },
  { item: 'Battery' },
  { item: 'Ball' },
  { item: 'Belt' },
  { item: 'Umbrella' },
  { item: 'White cap' },
  { item: 'Yellow shirt' },
  { item: 'Wet tissue' },
  { item: 'Water bottle' },
  { item: 'Toy' },
]

export function FlagRetrievalFacilitator() {
  const [tab, setTab] = useState<'orange' | 'green'>('orange')

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col relative overflow-x-hidden">
      <ParticleBackground />

      <header className="relative z-10 px-5 py-4 flex items-center justify-between">
        <a href="/" className="text-white/40 hover:text-white text-sm transition-colors">← Home</a>
        <h1 className="text-white font-black text-lg tracking-tight">Flag Retrieval — Faci</h1>
        <div className="w-16" />
      </header>

      {/* Tab bar */}
      <div className="relative z-10 flex items-center gap-2 px-5 mb-6">
        <button
          onClick={() => setTab('orange')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-wider transition-all ${
            tab === 'orange'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-white/10 text-white/50 hover:text-white'
          }`}
        >
          🟠 Orange Card Hunt
        </button>
        <button
          onClick={() => setTab('green')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm tracking-wider transition-all ${
            tab === 'green'
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
              : 'bg-white/10 text-white/50 hover:text-white'
          }`}
        >
          🟢 Green Flag Hunt
        </button>
      </div>

      {/* Content */}
      <main className="relative z-10 flex-1 px-5 pb-8">
        {tab === 'orange' && (
          <div className="flex flex-col gap-3">
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Acceptance Checklist — verify all before marking done</p>
            {ORANGE_ANSWERS.map((a, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/8 rounded-2xl px-4 py-3.5 border border-orange-500/20">
                <span className="text-lg font-black text-orange-500/60 w-6 text-right shrink-0">{i + 1}</span>
                <span className="text-white text-lg font-bold flex-1">{a.item}</span>
                {a.qty !== null && (
                  <span className="shrink-0 px-3 py-1 rounded-full bg-orange-500 text-white text-sm font-black">
                    ×{a.qty}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'green' && (
          <div className="flex flex-col gap-3">
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Items to collect — 10 total</p>
            {GREEN_ANSWERS.map((a, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/8 rounded-2xl px-4 py-3.5 border border-green-500/20">
                <span className="text-lg font-black text-green-500/60 w-6 text-right shrink-0">{i + 1}</span>
                <span className="text-white text-lg font-bold flex-1">{a.item}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
