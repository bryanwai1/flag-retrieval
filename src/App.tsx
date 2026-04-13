import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameSelector } from './pages/GameSelector'
import { ProjectorDisplay } from './pages/ProjectorDisplay'
import { ProjectorView } from './pages/ProjectorView'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminTaskEdit } from './pages/AdminTaskEdit'
import { ParticipantView } from './pages/ParticipantView'
import { InstructionsSlide } from './pages/InstructionsSlide'
import { ShapeSequenceProjector } from './pages/ShapeSequenceProjector'
import { ShapeSequenceAdmin } from './pages/ShapeSequenceAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameSelector />} />
        <Route path="/flag-retrieval" element={<ProjectorDisplay />} />
        <Route path="/instructions" element={<InstructionsSlide />} />
        <Route path="/projector" element={<ProjectorView />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/task/:taskId" element={<AdminTaskEdit />} />
        <Route path="/task/:taskId" element={<ParticipantView />} />
        <Route path="/shape-sequence" element={<ShapeSequenceProjector />} />
        <Route path="/shape-sequence/admin" element={<ShapeSequenceAdmin />} />
      </Routes>
    </BrowserRouter>
  )
}
