/**
 * Roulette wheel artwork — where each slice actually sits.
 *
 * The two wheels are generated images with their labels baked in, so the app
 * cannot assume the slices are evenly spaced: it has to know the real angle of
 * every slice or the pointer would stop on the wrong word. These tables were
 * measured off the images themselves (sampling the wedge colours around the
 * disc), which is why the genre wheel's angles are irregular — the artwork's
 * slices genuinely are.
 *
 * Angles: degrees clockwise from 12 o'clock, giving the CENTRE of each slice.
 * Entry i belongs to item i of that slot's pool in AITB_POOLS, so the order
 * here must stay in step with the pool order.
 *
 * If a wheel image is ever regenerated, re-measure it and replace the table —
 * the pointer's accuracy depends entirely on these numbers matching the art.
 */
import type { AitbPoolKey } from './aitbActivities'

export type AitbWheelArt = {
  src: string
  /** Slice centre angles, one per pool item, in pool order. */
  mids: number[]
}

/** Genre — 15 slices, hand-measured (the art's slices are not equal width). */
const GENRE_MIDS = [
  0.20,   // K-Pop
  23.00,  // Dangdut
  45.75,  // Bollywood
  68.85,  // EDM Anthem
  92.15,  // Country Ballad
  116.35, // Opera
  141.95, // Hip-Hop
  167.45, // Reggae
  191.10, // Smooth Jazz
  213.45, // 70s Disco
  235.30, // Lo-fi Chill
  260.25, // Broadway Musical
  288.10, // Acoustic Café
  313.80, // Joget
  337.30, // Nursery Rhyme
]

/** Topic — 14 equal slices of 360/14, offset 13.0deg; measured spread was 0.34deg. */
const TOPIC_MIDS = Array.from({ length: 14 }, (_, i) => (0.143 + i * (360 / 14)) % 360)

export const AITB_WHEEL_ART: Partial<Record<AitbPoolKey, AitbWheelArt>> = {
  genre: { src: '/aitb/wheel/genre.webp', mids: GENRE_MIDS },
  topic: { src: '/aitb/wheel/topic.webp', mids: TOPIC_MIDS },
}

export function aitbWheelArt(pool: AitbPoolKey): AitbWheelArt | undefined {
  return AITB_WHEEL_ART[pool]
}
