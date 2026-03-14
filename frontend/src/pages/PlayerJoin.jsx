import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import './PlayerJoin.css'

export default function PlayerJoin() {
  const { roomCode: urlCode } = useParams()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const [roomCode, setRoomCode] = useState(urlCode || '')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = () => {
    if (!roomCode.trim()) return setError('Ingresá el código de sala')
    if (!playerName.trim()) return setError('Ingresá tu nombre')
    setError('')
    setJoining(true)
    socket.emit('join-room', { roomCode: roomCode.trim().toUpperCase(), playerName: playerName.trim() },
      ({ success, error: err, state, card, cardSize }) => {
        setJoining(false)
        if (err) return setError(err)
        navigate(`/play/${roomCode.trim().toUpperCase()}`, {
          state: { playerName: playerName.trim(), gameState: state, card, cardSize }
        })
      }
    )
  }

  return (
    <div className="join">
      <div className="join-inner fade-in">
        <div className="join-logo">
          <span className="join-note">♪</span>
          <h1>BINGO<br/>MUSICAL</h1>
        </div>
        <div className="card join-card">
          <h2>Unirse a la mesa</h2>
          <div className="field">
            <label>Código de sala</label>
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '20px' }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          <div className="field">
            <label>Tu nombre</label>
            <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Ej: Sofía" maxLength={20}
              onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn-primary join-btn" onClick={handleJoin} disabled={joining}>
            {joining ? 'Entrando...' : '🎵 Entrar al juego'}
          </button>
        </div>
      </div>
    </div>
  )
}
