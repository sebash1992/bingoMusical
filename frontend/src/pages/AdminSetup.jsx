import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import './AdminSetup.css'

function extractYoutubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return match ? match[1] : null
}

export default function AdminSetup() {
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [adminName, setAdminName] = useState('')
  const [cardSize, setCardSize] = useState(4)
  const [clipDuration, setClipDuration] = useState(5)
  const [songs, setSongs] = useState([{ youtubeUrl: '', startSeconds: 0, label: '' }])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const minSongs = cardSize * cardSize
  const addSong = () => setSongs([...songs, { youtubeUrl: '', startSeconds: 0, label: '' }])
  const removeSong = (i) => setSongs(songs.filter((_, idx) => idx !== i))
  const updateSong = (i, field, value) => {
    const updated = [...songs]
    updated[i] = { ...updated[i], [field]: value }
    setSongs(updated)
  }

  const handleCreate = () => {
    if (!adminName.trim()) return setError('Ponete un nombre')
    const valid = songs.filter(s => s.youtubeUrl.trim() && s.label.trim())
    if (valid.length < minSongs) return setError(`Necesitás al menos ${minSongs} canciones con nombre para un cartón ${cardSize}x${cardSize}`)
    const invalid = valid.find(s => !extractYoutubeId(s.youtubeUrl))
    if (invalid) return setError('Hay un link de YouTube inválido')

    setError('')
    setCreating(true)

    socket.emit('create-room', { adminName: adminName.trim() }, ({ roomCode, adminToken }) => {
      localStorage.setItem(`bingo-admin-token-${roomCode}`, adminToken)
      const processed = valid.map(s => ({
        ...s,
        youtubeId: extractYoutubeId(s.youtubeUrl),
        startSeconds: Number(s.startSeconds) || 0,
      }))
      socket.emit('update-songs', { adminToken, songs: processed, cardSize })
      navigate(`/admin/game/${roomCode}`, { state: { adminToken, clipDuration } })
    })
  }

  return (
    <div className="setup">
      <div className="setup-inner fade-in">
        <div className="setup-header">
          <button className="btn-secondary" onClick={() => navigate('/')}>← Volver</button>
          <h1>Nueva Mesa</h1>
        </div>

        <div className="card">
          <h2>Configuración</h2>
          <div className="field">
            <label>Tu nombre (admin)</label>
            <input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ej: Lucas" maxLength={20} />
          </div>
          <div className="config-row">
            <div className="field">
              <label>Tamaño del cartón</label>
              <div className="size-btns">
                {[1,2,3,4,5].map(s => (
                  <button key={s} className={`size-btn ${cardSize === s ? 'active' : ''}`} onClick={() => setCardSize(s)}>
                    {s}×{s}
                  </button>
                ))}
              </div>
              <span className="field-hint">Necesitás {s => s * s} canciones mínimo</span>
            </div>
            <div className="field">
              <label>Duración del clip (seg)</label>
              <input type="number" min={1} max={60} value={clipDuration} onChange={e => setClipDuration(Number(e.target.value))} style={{width: 80}} />
            </div>
          </div>
          <p className="min-songs-hint">
            Cartón {cardSize}×{cardSize} → necesitás mínimo <strong>{minSongs} canciones</strong>. Cuantas más pongas, más variados serán los cartones.
          </p>
        </div>

        <div className="songs-section">
          <div className="songs-header">
            <h2>Canciones <span className={songs.filter(s=>s.label&&s.youtubeUrl).length >= minSongs ? 'count-ok' : 'count-warn'}>({songs.filter(s=>s.label&&s.youtubeUrl).length}/{minSongs} mínimo)</span></h2>
            <button className="btn-secondary" onClick={addSong}>+ Agregar</button>
          </div>
          <div className="songs-list">
            {songs.map((song, i) => (
              <div key={i} className="song-card card fade-in">
                <div className="song-num">#{i+1}</div>
                <div className="song-fields">
                  <div className="field">
                    <label>Nombre de la canción (aparece en el cartón) *</label>
                    <input value={song.label} onChange={e => updateSong(i, 'label', e.target.value)} placeholder="Ej: Bohemian Rhapsody - Queen" />
                  </div>
                  <div className="song-row">
                    <div className="field">
                      <label>Link de YouTube *</label>
                      <input value={song.youtubeUrl} onChange={e => updateSong(i, 'youtubeUrl', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                      {song.youtubeUrl && !extractYoutubeId(song.youtubeUrl) && <span className="field-error">Link inválido</span>}
                    </div>
                    <div className="field">
                      <label>Segundo de inicio</label>
                      <input type="number" min={0} value={song.startSeconds} onChange={e => updateSong(i, 'startSeconds', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
                {songs.length > 1 && <button className="song-remove" onClick={() => removeSong(i)}>✕</button>}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}
        <button className="btn-primary create-btn" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creando...' : '🎲 Crear Mesa'}
        </button>
      </div>
    </div>
  )
}
