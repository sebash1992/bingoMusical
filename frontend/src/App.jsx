import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import Home from './pages/Home'
import AdminSetup from './pages/AdminSetup'
import AdminGame from './pages/AdminGame'
import PlayerJoin from './pages/PlayerJoin'
import PlayerGame from './pages/PlayerGame'

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/setup" element={<AdminSetup />} />
          <Route path="/admin/game/:roomCode" element={<AdminGame />} />
          <Route path="/join/:roomCode?" element={<PlayerJoin />} />
          <Route path="/play/:roomCode" element={<PlayerGame />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  )
}
