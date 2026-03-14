import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import YouTubePlayer from '../components/YouTubePlayer'
import BingoCard from '../components/BingoCard'
import './PlayerGame.css'

export default function PlayerGame() {
  const { roomCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const playerName = location.state?.playerName
  const [card, setCard] = useState(location.state?.card || [])
  const [cardSize, setCardSize] = useState(location.state?.cardSize || 4)
  const [gameState, setGameState] = useState(location.state?.gameState?.gameState || null)
  const [playedSongIds, setPlayedSongIds] = useState(location.state?.gameState?.gameState?.playedSongIds || [])
  const [activeSong, setActiveSong] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [bingoResult, setBingoResult] = useState(null)
  const [gameStarted, setGameStarted] = useState(location.state?.gameState?.gameState?.status !== 'waiting')
  const [revealedSong, setRevealedSong] = useState(null)
  const [totalPoolSongs, setTotalPoolSongs] = useState(null)
  // Song submission
  const [mySongs, setMySongs] = useState([{ youtubeUrl: '', label: '' }])
  const [songsSent, setSongsSent] = useState(false)
  const playerRef = useRef(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    if (!playerName) navigate(`/join/${roomCode}`)
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('songs-updated', ({ totalSongs }) => {
      setTotalPoolSongs(totalSongs)
    })

    socket.on('state-update', (state) => {
      setGameState(state.gameState)
      setPlayedSongIds(state.gameState?.playedSongIds || [])
    })

    socket.on('game-started', ({ cardSize: cs }) => {
      setCardSize(cs)
      setGameStarted(true)
      setBingoResult(null)
    })

    socket.on('your-card', ({ card: c, cardSize: cs }) => {
      setCard(c)
      setCardSize(cs)
    })

    socket.on('card-update', ({ card: c }) => {
      setCard(c)
    })

    socket.on('prepare-song', ({ song, countdown: cd }) => {
      setActiveSong(song) // load player early
      setRevealedSong(null)
      clearInterval(countdownRef.current)
      setCountdown(cd)
      let r = cd
      countdownRef.current = setInterval(() => {
        r -= 1
        if (r <= 0) { clearInterval(countdownRef.current); setCountdown(null) }
        else setCountdown(r)
      }, 1000)
    })

    socket.on('start-song', ({ clipDuration }) => {
      clearInterval(countdownRef.current)
      setCountdown(null)
      playerRef.current?.playVideo()
      setTimeout(() => playerRef.current?.pauseVideo(), clipDuration * 1000)
    })

    socket.on('stop-song', () => {
      clearInterval(countdownRef.current)
      setCountdown(null)
      playerRef.current?.pauseVideo()
    })

    socket.on('song-revealed', ({ songId, label }) => {
      setPlayedSongIds(prev => prev.includes(songId) ? prev : [...prev, songId])
      setRevealedSong(label)
      setTimeout(() => setRevealedSong(null), 4000)
    })

    socket.on('bingo-claimed', ({ player }) => {
      if (player.socketId !== socket.id) {
        setBingoResult({ type: 'other', name: player.name })
        setTimeout(() => setBingoResult(null), 4000)
      }
    })

    socket.on('bingo-confirmed', ({ player, finished, winners }) => {
      if (player.socketId === socket.id) {
        setBingoResult({ type: 'my-win', finished })
      } else {
        setBingoResult({ type: 'other-win', name: player.name, finished })
        setTimeout(() => setBingoResult(null), 5000)
      }
    })

    socket.on('bingo-rejected', ({ player }) => {
      if (player?.socketId === socket.id) {
        setBingoResult({ type: 'rejected' })
        setTimeout(() => setBingoResult(null), 3000)
      } else {
        setBingoResult(null)
      }
    })

    return () => {
      socket.off('songs-updated')
      socket.off('state-update')
      socket.off('game-started')
      socket.off('your-card')
      socket.off('card-update')
      socket.off('prepare-song')
      socket.off('start-song')
      socket.off('stop-song')
      socket.off('song-revealed')
      socket.off('bingo-claimed')
      socket.off('bingo-confirmed')
      socket.off('bingo-rejected')
    }
  }, [socket])

  const handleMark = (songId) => {
    socket.emit('mark-cell', { roomCode, songId })
  }

  const handleClaimBingo = () => {
    socket.emit('claim-bingo', { roomCode })
  }

  function extractYoutubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  const updateMySong = (i, field, value) => {
    const updated = [...mySongs]
    updated[i] = { ...updated[i], [field]: value }
    setMySongs(updated)
  }

  const handleSubmitSongs = () => {
    const valid = mySongs.filter(s => s.label.trim() && s.youtubeUrl.trim() && extractYoutubeId(s.youtubeUrl))
    if (valid.length === 0) return
    const processed = valid.map(s => ({
      label: s.label.trim(),
      youtubeUrl: s.youtubeUrl.trim(),
      youtubeId: extractYoutubeId(s.youtubeUrl),
      startSeconds: Number(s.startSeconds) || 0,
    }))
    socket.emit('submit-songs', { roomCode, songs: processed })
    setSongsSent(true)
  }

  const allMarked = card.length > 0 && card.every(c => c.marked)
  const markedCount = card.filter(c => c.marked).length
  const status = gameState?.status || 'waiting'
  const winners = gameState?.winners || []

  return (
    <div className="player-game">
      {/* Hidden YouTube player */}
      {activeSong && (
        <YouTubePlayer key={activeSong.youtubeId} ref={playerRef} videoId={activeSong.youtubeId} startSeconds={activeSong.startSeconds} hidden={true} />
      )}

      {/* Bingo result overlay */}
      {bingoResult && (
        <div className={`bingo-banner bingo-${bingoResult.type} fade-in`}>
          {bingoResult.type === 'my-win' && (
            <>🏆 ¡BINGO! ¡Ganaste! {bingoResult.finished ? '🎉 ¡Juego terminado!' : '¡Seguimos!'}</>
          )}
          {bingoResult.type === 'rejected' && <>❌ Tu bingo fue rechazado — seguí marcando</>}
          {bingoResult.type === 'other' && <>{bingoResult.name} cantó BINGO... esperando confirmación</>}
          {bingoResult.type === 'other-win' && <>🏆 {bingoResult.name} hizo BINGO! {bingoResult.finished ? 'Juego terminado' : 'Seguimos'}</>}
        </div>
      )}

      {/* Revealed song banner */}
      {revealedSong && (
        <div className="revealed-banner fade-in">
          🎵 <strong>{revealedSong}</strong> — ¡Marcá si la tenés!
        </div>
      )}

      {/* Countdown overlay */}
      {countdown && (
        <div className="countdown-overlay">
          <div className="countdown-num pop-in">{countdown}</div>
        </div>
      )}

      <div className="player-layout">
        {/* Header */}
        <div className="player-header">
          <div>
            <div className="ph-label">Jugando como</div>
            <div className="ph-name">{playerName}</div>
          </div>
          <div className="ph-right">
            <div className="ph-label">Sala</div>
            <div className="ph-code">{roomCode}</div>
          </div>
        </div>

        {/* Status bar */}
        <div className={`status-bar status-${status}`}>
          {status === 'waiting' && '⏳ Esperando que el admin inicie el juego...'}
          {status === 'playing' && !countdown && '🎵 Escuchá y marcá las canciones de tu cartón'}
          {status === 'playing' && countdown && `🎵 Arrancando en ${countdown}...`}
          {status === 'bingo-claimed' && '🎉 ¡Alguien cantó BINGO! Esperando al admin...'}
          {status === 'finished' && '🏁 ¡Juego terminado!'}
        </div>

        {/* Winners */}
        {winners.length > 0 && (
          <div className="winners-bar">
            🏆 {winners.map(w => w.name).join(', ')}
          </div>
        )}

        {/* Progress */}
        {gameStarted && card.length > 0 && (
          <div className="progress-row">
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill" style={{ width: `${(markedCount / card.length) * 100}%` }} />
            </div>
            <span className="progress-label">{markedCount}/{card.length} marcadas</span>
          </div>
        )}

        {/* Bingo Card OR waiting/submission screen */}
        {gameStarted && card.length > 0 ? (
          <BingoCard
            card={card}
            cardSize={cardSize}
            playedSongIds={playedSongIds}
            onMark={handleMark}
            readonly={status === 'bingo-claimed' || status === 'finished'}
          />
        ) : (
          <div className="waiting-area">
            {/* Song submission */}
            {!songsSent ? (
              <div className="card submission-card">
                <div className="submission-title">🎵 ¿Querés agregar canciones al pool?</div>
                <p className="submission-sub">Son opcionales. Van al pool general y pueden salirle a cualquiera.</p>
                <div className="my-songs-list">
                  {mySongs.map((s, i) => (
                    <div key={i} className="my-song-row">
                      <div className="field">
                        <label>Nombre *</label>
                        <input value={s.label} onChange={e => updateMySong(i, 'label', e.target.value)} placeholder="Ej: Wonderwall - Oasis" />
                      </div>
                      <div className="field">
                        <label>Link YouTube *</label>
                        <input value={s.youtubeUrl} onChange={e => updateMySong(i, 'youtubeUrl', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                        {s.youtubeUrl && !extractYoutubeId(s.youtubeUrl) && <span className="field-error">Link inválido</span>}
                      </div>
                      <div className="field">
                        <label>Segundo de inicio</label>
                        <input type="number" min={0} value={s.startSeconds || 0} onChange={e => updateMySong(i, 'startSeconds', e.target.value)} style={{width: 80}} />
                      </div>
                      {mySongs.length > 1 && (
                        <button className="remove-song-btn" onClick={() => setMySongs(mySongs.filter((_, idx) => idx !== i))}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="submission-actions">
                  <button className="btn-secondary" onClick={() => setMySongs([...mySongs, { youtubeUrl: '', label: '', startSeconds: 0 }])}>
                    + Agregar otra
                  </button>
                  <button className="btn-primary" onClick={handleSubmitSongs}
                    disabled={!mySongs.some(s => s.label.trim() && extractYoutubeId(s.youtubeUrl))}>
                    Enviar canciones
                  </button>
                  <button className="btn-secondary skip-btn" onClick={() => setSongsSent(true)}>
                    Saltar →
                  </button>
                </div>
              </div>
            ) : (
              <div className="card waiting-card">
                <div className="waiting-icon">🎲</div>
                <p>Esperando que el admin inicie el juego...</p>
                {totalPoolSongs && <p className="pool-count">{totalPoolSongs} canciones en el pool</p>}
              </div>
            )}
          </div>
        )}

        {/* BINGO button */}
        {gameStarted && (
          <div className="bingo-btn-area">
            <button
              className={`bingo-claim-btn ${allMarked ? 'ready' : 'disabled'}`}
              onClick={handleClaimBingo}
              disabled={!allMarked || status !== 'playing'}
            >
              <span className="bingo-btn-text">¡BINGO!</span>
              {!allMarked && <span className="bingo-btn-hint">Marcá todas las celdas para cantar bingo</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
