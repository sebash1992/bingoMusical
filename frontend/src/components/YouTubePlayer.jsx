import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

/**
 * Permanent YouTube player — mounts ONCE, never destroyed.
 * Swaps videos with cueVideoById/loadVideoById instead of remounting,
 * avoiding the React + YT API removeChild DOM collision crash.
 */
const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, startSeconds, hidden }, ref) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const pendingRef = useRef(null) // { videoId, startSeconds, play }
  // Track latest props in refs so effects can access them without re-running
  const videoIdRef = useRef(videoId)
  const startSecondsRef = useRef(startSeconds)
  useEffect(() => { videoIdRef.current = videoId }, [videoId])
  useEffect(() => { startSecondsRef.current = startSeconds }, [startSeconds])

  useImperativeHandle(ref, () => ({
    playVideo() {
      const v = videoIdRef.current
      const s = startSecondsRef.current || 0
      if (readyRef.current && playerRef.current) {
        playerRef.current.loadVideoById({ videoId: v, startSeconds: s })
        playerRef.current.playVideo()
      } else {
        pendingRef.current = { videoId: v, startSeconds: s, play: true }
      }
    },
    pauseVideo() {
      pendingRef.current = null
      if (readyRef.current && playerRef.current) {
        try { playerRef.current.pauseVideo() } catch (_) {}
      }
    },
  }))

  // Mount player exactly once
  useEffect(() => {
    const containerId = `yt-player-${Math.random().toString(36).slice(2)}`
    if (containerRef.current) containerRef.current.id = containerId

    function initPlayer() {
      if (!containerRef.current) return
      playerRef.current = new window.YT.Player(containerId, {
        height: hidden ? '1' : '220',
        width: '100%',
        videoId: videoIdRef.current || '',
        playerVars: { autoplay: 0, controls: hidden ? 0 : 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true
            if (pendingRef.current) {
              const { videoId: v, startSeconds: s, play } = pendingRef.current
              pendingRef.current = null
              if (play) {
                playerRef.current.loadVideoById({ videoId: v, startSeconds: s })
                playerRef.current.playVideo()
              } else {
                playerRef.current.cueVideoById({ videoId: v, startSeconds: s })
              }
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
    // No cleanup — intentionally keep player alive to avoid DOM collision crash
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When videoId changes, cue the new video without auto-playing
  useEffect(() => {
    if (!videoId || !readyRef.current || !playerRef.current) return
    try {
      playerRef.current.cueVideoById({ videoId, startSeconds: startSeconds || 0 })
    } catch (_) {}
  }, [videoId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={hidden
        ? { position: 'fixed', left: '-9999px', top: '-9999px', width: 1, height: 1, pointerEvents: 'none' }
        : { width: '100%' }}
    />
  )
})

export default YouTubePlayer
