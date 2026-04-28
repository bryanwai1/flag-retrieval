import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ParticipantView } from './pages/ParticipantView'
import { FlagRetrievalFacilitator } from './pages/FlagRetrievalFacilitator'

const GameSelector          = lazy(() => import('./pages/GameSelector').then(m => ({ default: m.GameSelector })))
const ProjectorDisplay      = lazy(() => import('./pages/ProjectorDisplay').then(m => ({ default: m.ProjectorDisplay })))
const ProjectorView         = lazy(() => import('./pages/ProjectorView').then(m => ({ default: m.ProjectorView })))
const AdminDashboard        = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminTaskEdit         = lazy(() => import('./pages/AdminTaskEdit').then(m => ({ default: m.AdminTaskEdit })))
const InstructionsSlide     = lazy(() => import('./pages/InstructionsSlide').then(m => ({ default: m.InstructionsSlide })))
const InstructionsHub       = lazy(() => import('./pages/InstructionsHub').then(m => ({ default: m.InstructionsHub })))
const ShapeSequenceProjector = lazy(() => import('./pages/ShapeSequenceProjector').then(m => ({ default: m.ShapeSequenceProjector })))
const ShapeSequenceAdmin    = lazy(() => import('./pages/ShapeSequenceAdmin').then(m => ({ default: m.ShapeSequenceAdmin })))
const ShapeSequenceFacilitator = lazy(() => import('./pages/ShapeSequenceFacilitator').then(m => ({ default: m.ShapeSequenceFacilitator })))
const EventSlide            = lazy(() => import('./pages/EventSlide').then(m => ({ default: m.EventSlide })))
const GroupingSlide         = lazy(() => import('./pages/GroupingSlide').then(m => ({ default: m.GroupingSlide })))
const BingoDashHome         = lazy(() => import('./pages/BingoDashHome').then(m => ({ default: m.BingoDashHome })))
const BingoDashParticipant  = lazy(() => import('./pages/BingoDashParticipant').then(m => ({ default: m.BingoDashParticipant })))
const BingoDashAdmin        = lazy(() => import('./pages/BingoDashAdmin').then(m => ({ default: m.BingoDashAdmin })))
const BingoDashTaskEdit     = lazy(() => import('./pages/BingoDashTaskEdit').then(m => ({ default: m.BingoDashTaskEdit })))
const BingoDashProjector    = lazy(() => import('./pages/BingoDashProjector').then(m => ({ default: m.BingoDashProjector })))
const BingoDashJoin         = lazy(() => import('./pages/BingoDashJoin').then(m => ({ default: m.BingoDashJoin })))
const BingoDashColmarIntro  = lazy(() => import('./pages/BingoDashColmarIntro').then(m => ({ default: m.BingoDashColmarIntro })))
const BingoDashSlidesHub    = lazy(() => import('./pages/BingoDashSlidesHub').then(m => ({ default: m.BingoDashSlidesHub })))
const BingoDashAwardSlides  = lazy(() => import('./pages/BingoDashAwardSlides').then(m => ({ default: m.BingoDashAwardSlides })))
const BingoDashAwardAdmin   = lazy(() => import('./pages/BingoDashAwardAdmin').then(m => ({ default: m.BingoDashAwardAdmin })))
const BingoDashBriefingSlides = lazy(() => import('./pages/BingoDashBriefingSlides').then(m => ({ default: m.BingoDashBriefingSlides })))
const SnakeLadderBoard      = lazy(() => import('./pages/SnakeLadderBoard').then(m => ({ default: m.SnakeLadderBoard })))
const SnakeLadderAdmin      = lazy(() => import('./pages/SnakeLadderAdmin').then(m => ({ default: m.SnakeLadderAdmin })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<GameSelector />} />
          <Route path="/flag-retrieval" element={<ProjectorDisplay />} />
          <Route path="/instructions" element={<InstructionsHub />} />
          <Route path="/instructions/:deckId" element={<InstructionsSlide />} />
          <Route path="/projector" element={<ProjectorView />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/task/:taskId" element={<AdminTaskEdit />} />
          <Route path="/task/:taskId" element={<ParticipantView />} />
          <Route path="/flag-retrieval/facilitator" element={<FlagRetrievalFacilitator />} />
          <Route path="/shape-sequence" element={<ShapeSequenceProjector />} />
          <Route path="/shape-sequence/admin" element={<ShapeSequenceAdmin />} />
          <Route path="/shape-sequence/facilitator" element={<ShapeSequenceFacilitator />} />
          <Route path="/event" element={<EventSlide />} />
          <Route path="/event/grouping" element={<GroupingSlide />} />
          <Route path="/bingo-dash" element={<BingoDashHome />} />
          <Route path="/bingo-dash/task/:taskId" element={<BingoDashParticipant />} />
          <Route path="/bingo-dash/admin" element={<BingoDashAdmin />} />
          <Route path="/bingo-dash/admin/task/:taskId" element={<BingoDashTaskEdit />} />
          <Route path="/bingo-dash/projector" element={<BingoDashProjector />} />
          <Route path="/bingo-dash/play/:sectionSlug" element={<BingoDashJoin />} />
          <Route path="/bingo-dash/colmar-intro" element={<BingoDashColmarIntro />} />
          <Route path="/bingo-dash/slides" element={<BingoDashSlidesHub />} />
          <Route path="/bingo-dash/slides/awards" element={<BingoDashAwardSlides />} />
          <Route path="/bingo-dash/slides/awards/:sectionSlug" element={<BingoDashAwardSlides />} />
          <Route path="/bingo-dash/slides/awards/:sectionSlug/admin" element={<BingoDashAwardAdmin />} />
          <Route path="/bingo-dash/slides/briefing" element={<BingoDashBriefingSlides />} />
          <Route path="/bingo-dash/slides/briefing/:sectionSlug" element={<BingoDashBriefingSlides />} />
          <Route path="/snake-ladder" element={<SnakeLadderBoard />} />
          <Route path="/snake-ladder/admin" element={<SnakeLadderAdmin />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
