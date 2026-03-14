import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, startSeconds, hidden }, ref) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)

  useImperativeHandle(ref, () => ({
    playVideo() {
      if (readyRef.current) {
        playerRef.current?.seekTo(startSeconds || 0, true)
        playerRef.current?.playVideo()
      } else {
        pendingPlayRef.current = true
      }
    },
    pauseVideo() {
      pendingPlayRef.current = false
      if (readyRef.current) playerRef.current?.pauseVideo()
    },
  }))

  useEffect(() => {
    if (!videoId) return
    readyRef.current = false
    pendingPlayRef.current = false

    const containerId = `yt-${Math.random().toString(36).slice(2)}`
    if (containerRef.current) containerRef.current.id = containerId

    function initPlayer() {
      if (!containerRef.current) return
      playerRef.current = new window.YT.Player(containerId, {
        height: hidden ? '1' : '220',
        width: '100%',
        videoId,
        playerVars: { autoplay: 0, controls: hidden ? 0 : 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            readyRef.current = true
            if (pendingPlayRef.current) {
              pendingPlayRef.current = false
              e.target.seekTo(startSeconds || 0, true)
              e.target.playVideo()
            }
          },
        },
      })
    }

    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script')
        tag.id = 'yt-api-script'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.body.appendChild(tag)
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
    }

    return () => {
      readyRef.current = false
      pendingPlayRef.current = false
      try { playerRef.current?.destroy() } catch (_) {}
    }
  }, [videoId])

  return (
    <div ref={containerRef}
      style={hidden
        ? { position: 'fixed', left: '-9999px', top: '-9999px', width: 1, height: 1, pointerEvents: 'none' }
        : { width: '100%' }}
    />
  )
})

export default YouTubePlayer
