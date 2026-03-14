import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import YouTubePlayer from '../components/YouTubePlayer'
import './AdminGame.css'

export default function AdminGame() {
  const { roomCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const adminToken = location.state?.adminToken || localStorage.getItem(`bingo-admin-token-${roomCode}`)

  const [gameState, setGameState] = useState(null)
  const [songs, setSongs] = useState([])
  const [cardSize, setCardSize] = useState(4)
  const [clipDuration, setClipDuration] = useState(location.state?.clipDuration || 5)
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [activeSong, setActiveSong] = useState(null) // the song currently loaded in the player
  const [isPlaying, setIsPlaying] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notification, setNotification] = useState(null)
  const [bingoAlert, setBingoAlert] = useState(null)
  const playerRef = useRef(null)
  const timerRef = useRef(null)
  const countdownRef = useRef(null)
  const COUNTDOWN_SEC = 3

  const shareUrl = `${window.location.origin}/join/${roomCode}`

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3000)
  }

  useEffect(() => {
    if (!socket || !adminToken) return

    socket.emit('admin-rejoin', { adminToken }, ({ room, songs: s, cardSize: cs, error }) => {
      if (error) { navigate('/'); return }
      // players are at room.players (array), not inside gameState
      setGameState(prev => ({
        ...(room?.gameState || {}),
        players: room?.players ?? []
      }))
      setSongs(s || [])
      if (cs) setCardSize(cs)
      if (room?.gameState?.clipDuration) setClipDuration(room.gameState.clipDuration)
      if (room?.gameState?.status !== 'waiting') setGameStarted(true)
      if (room?.gameState?.currentSongIndex >= 0) setCurrentSongIndex(room.gameState.currentSongIndex + 1)
    })

    socket.on('state-update', (state) => {
      // players lives at root of state, not inside gameState
      setGameState(prev => ({
        ...state.gameState,
        players: state.players ?? prev?.players ?? []
      }))
    })
    socket.on('player-joined', ({ name }) => notify(`${name} se unió 🎉`, 'success'))
    socket.on('player-left', ({ name }) => notify(`${name} se fue`, 'info'))
    socket.on('player-songs-added', ({ playerName, count, totalSongs }) => {
      notify(`${playerName} agregó ${count} canción${count > 1 ? 'es' : ''} (total: ${totalSongs})`, 'success')
    })

    socket.on('prepare-song', ({ song, countdown: cd }) => {
      setActiveSong(song) // load the player immediately
      clearInterval(countdownRef.current)
      setCountdown(cd)
      let r = cd
      countdownRef.current = setInterval(() => {
        r -= 1
        if (r <= 0) { clearInterval(countdownRef.current); setCountdown(null) }
        else setCountdown(r)
      }, 1000)
    })

    socket.on('start-song', ({ clipDuration: cd }) => {
      clearInterval(countdownRef.current)
      setCountdown(null)
      setIsPlaying(true)
      playerRef.current?.playVideo()
      timerRef.current = setTimeout(() => {
        setIsPlaying(false)
        playerRef.current?.pauseVideo()
      }, cd * 1000)
    })

    socket.on('stop-song', () => {
      clearInterval(countdownRef.current)
      clearTimeout(timerRef.current)
      setCountdown(null)
      setIsPlaying(false)
      playerRef.current?.pauseVideo()
    })

    socket.on('bingo-claimed', ({ player, allMarked, card }) => {
      setBingoAlert({ player, allMarked, card })
    })

    socket.on('bingo-confirmed', ({ player, finished, winners }) => {
      setBingoAlert(null)
      notify(`🏆 ${player.name} hizo BINGO!`, 'success')
      if (finished) notify('🎉 ¡Juego terminado!', 'success')
    })

    socket.on('bingo-rejected', ({ player }) => {
      setBingoAlert(null)
      notify(`❌ Bingo falso de ${player?.name}`, 'danger')
    })

    return () => {
      socket.off('state-update')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('player-songs-added')
      socket.off('prepare-song')
      socket.off('start-song')
      socket.off('stop-song')
      socket.off('bingo-claimed')
      socket.off('bingo-confirmed')
      socket.off('bingo-rejected')
    }
  }, [socket, adminToken])

  const handleStartGame = () => {
    socket.emit('start-game', { adminToken })
    setGameStarted(true)
    setCurrentSongIndex(0)
    notify('🎲 ¡Juego iniciado! Los cartones fueron repartidos.', 'success')
  }

  const handlePlay = () => {
    clearTimeout(timerRef.current)
    clearInterval(countdownRef.current)
    socket.emit('play-song', { adminToken, songIndex: currentSongIndex, clipDuration, countdown: COUNTDOWN_SEC })
  }

  const handleStop = () => socket.emit('stop-song', { adminToken })

  const handleReveal = () => {
    socket.emit('reveal-song', { adminToken })
    notify('📢 Canción revelada — los jugadores pueden marcarla', 'info')
  }

  const handleNext = () => {
    clearTimeout(timerRef.current)
    clearInterval(countdownRef.current)
    setCountdown(null)
    setIsPlaying(false)
    playerRef.current?.pauseVideo()
    setCurrentSongIndex(i => i + 1)
    // Do NOT clear activeSong here — keep showing last video until next prepare-song arrives
  }

  const status = gameState?.status || 'waiting'
  const winners = gameState?.winners || []
  const playedCount = gameState?.playedSongIds?.length || 0
  const displaySong = activeSong // use local state, not server state

  return (
    <div className="admin-game">
      {notification && (
        <div className={`notif notif-${notification.type} fade-in`}>{notification.msg}</div>
      )}

      {/* Bingo alert modal */}
      {bingoAlert && (
        <div className="bingo-modal-overlay">
          <div className="bingo-modal pop-in">
            <div className="bingo-modal-title">🎉 ¡BINGO!</div>
            <p className="bingo-modal-name">{bingoAlert.player.name}</p>
            <p className="bingo-modal-sub">
              {bingoAlert.allMarked ? '✅ Tiene todas las celdas marcadas' : '⚠️ No tiene todas las celdas marcadas'}
            </p>
            <div className="bingo-modal-btns">
              <button className="btn-success" onClick={() => socket.emit('confirm-bingo-finish', { adminToken })}>
                🏆 Confirmar y terminar
              </button>
              <button className="btn-secondary" onClick={() => socket.emit('confirm-bingo-continue', { adminToken })}>
                🏅 Confirmar y seguir
              </button>
              <button className="btn-danger" onClick={() => socket.emit('reject-bingo', { adminToken })}>
                ❌ Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-layout">
        {/* LEFT */}
        <div className="admin-left">
          <div className="top-bar card">
            <div>
              <div className="room-label">Sala</div>
              <div className="room-code">{roomCode}</div>
            </div>
            <button className={`btn-secondary ${copied ? 'copied' : ''}`} onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
              {copied ? '✓ Copiado' : '📋 Copiar link'}
            </button>
          </div>

          {!gameStarted ? (
            <div className="card start-panel">
              <h2>¿Listo para empezar?</h2>
              <p>Los jugadores conectados recibirán su cartón al iniciar.</p>
              <p className="players-waiting">👥 {gameState?.players?.length || 0} jugadores esperando</p>
              <button className="btn-primary start-btn" onClick={handleStartGame}>
                🎲 Iniciar Juego y Repartir Cartones
              </button>
            </div>
          ) : (
            <>
              {/* YouTube player — always mounted once game starts to avoid DOM crash */}
              <div className="card player-wrap" style={displaySong ? {} : { display: 'none' }}>
                <YouTubePlayer ref={playerRef} videoId={displaySong?.youtubeId || ''} startSeconds={displaySong?.startSeconds || 0} hidden={false} />
              </div>

              {/* Current song info */}
              <div className="card current-song-info">
                <div className="song-counter">
                  Canción <span>{currentSongIndex + 1}</span> / {gameState?.shuffledTotal || songs.length}
                </div>
                {displaySong && (
                  <div className="current-song-name">{displaySong.label}</div>
                )}
              </div>
            </>
          )}

          {/* Winners */}
          {winners.length > 0 && (
            <div className="card winners-panel">
              <h3>🏆 Ganadores</h3>
              {winners.map((w, i) => (
                <div key={i} className="winner-row">#{i + 1} {w.name}</div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        {gameStarted && (
          <div className="admin-right">
            {/* Duration */}
            <div className="card">
              <label className="ctrl-label">⏱ Duración del clip</label>
              <div className="dur-row">
                {[3,5,7,10,15].map(d => (
                  <button key={d} className={`dur-btn ${clipDuration === d ? 'active' : ''}`} onClick={() => setClipDuration(d)}>{d}s</button>
                ))}
                <input type="number" min={1} max={60} value={clipDuration} onChange={e => setClipDuration(Number(e.target.value))} className="dur-input" />
              </div>
            </div>

            {/* Play controls */}
            <div className="card play-ctrl">
              <div className="play-status">
                <span className={`sdot ${countdown ? 'counting' : status}`} />
                <span className="stext">
                  {countdown ? `Arrancando en ${countdown}...` : ''}
                  {!countdown && status === 'playing' && 'Reproduciendo'}
                  {!countdown && status === 'waiting' && 'Esperando'}
                  {!countdown && status === 'bingo-claimed' && '🎉 ¡Alguien cantó BINGO!'}
                  {!countdown && status === 'finished' && '🏁 Juego terminado'}
                </span>
              </div>
              <div className="play-btns">
                {countdown ? (
                  <button className="btn-secondary play-btn" onClick={handleStop}>
                    <span className="cnum">{countdown}</span> Cancelar
                  </button>
                ) : !isPlaying ? (
                  <button className="btn-primary play-btn" onClick={handlePlay}>
                    ▶ Reproducir #{currentSongIndex + 1}
                  </button>
                ) : (
                  <button className="btn-secondary play-btn" onClick={handleStop}>⏹ Detener</button>
                )}
              </div>
              <div className="reveal-row">
                <button className="btn-secondary reveal-btn" onClick={handleReveal} disabled={gameState?.currentSongIndex < 0}>
                  📢 Revelar canción (los jugadores pueden marcarla)
                </button>
              </div>
              <div className="next-row">
                <button className="btn-secondary next-btn" onClick={handleNext}>
                  ⏭ Siguiente canción
                </button>
                <span className="played-count">{playedCount} reveladas</span>
              </div>
            </div>

            {/* Players progress */}
            <div className="card">
              <h3>Jugadores</h3>
              <div className="players-list">
                {(gameState?.players || []).map((p, i) => (
                  <div key={i} className={`player-row ${p.hasBingo ? 'bingo' : ''}`}>
                    <span className="p-name">{p.name}</span>
                    <div className="p-progress">
                      <div className="p-bar" style={{ width: `${(p.markedCount / p.totalCells) * 100}%` }} />
                    </div>
                    <span className="p-count">{p.markedCount}/{p.totalCells}</span>
                    {p.hasBingo && <span className="p-bingo">BINGO</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
