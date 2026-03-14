import './BingoCard.css'

export default function BingoCard({ card, cardSize, playedSongIds, onMark, readonly }) {
  if (!card || card.length === 0) return <div className="card-empty">Esperando cartón...</div>

  return (
    <div className="bingo-card" style={{ '--size': cardSize }}>
      {card.map((cell, i) => {
        const isPlayed = playedSongIds?.includes(cell.songId)
        const canMark = isPlayed && !readonly
        return (
          <button
            key={i}
            className={`bingo-cell ${cell.marked ? 'marked' : ''} ${isPlayed && !cell.marked ? 'available' : ''} ${!isPlayed ? 'locked' : ''}`}
            onClick={() => canMark && onMark(cell.songId)}
            disabled={readonly || !isPlayed}
            title={cell.label}
          >
            <span className="cell-label">{cell.label}</span>
            {cell.marked && <span className="cell-check">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
