import { useNavigate } from 'react-router-dom'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="home">
      <div className="home-dots" />
      <div className="home-content fade-in">
        <div className="home-logo">
          <div className="logo-balls">
            <span className="ball b1">♪</span>
            <span className="ball b2">♫</span>
            <span className="ball b3">♩</span>
          </div>
          <h1>BINGO<br/>MUSICAL</h1>
        </div>
        <p className="home-sub">Completá tu cartón con las canciones que suenan</p>
        <div className="home-actions">
          <button className="btn-primary home-btn" onClick={() => navigate('/admin/setup')}>
            🎲 Crear Mesa
          </button>
          <button className="btn-secondary home-btn" onClick={() => navigate('/join')}>
            🎵 Unirse a una Mesa
          </button>
        </div>
      </div>
    </div>
  )
}
