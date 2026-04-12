import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProjectorDisplay } from './pages/ProjectorDisplay'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminTaskEdit } from './pages/AdminTaskEdit'
import { ParticipantView } from './pages/ParticipantView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectorDisplay />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/task/:taskId" element={<AdminTaskEdit />} />
        <Route path="/task/:taskId" element={<ParticipantView />} />
      </Routes>
    </BrowserRouter>
  )
}
