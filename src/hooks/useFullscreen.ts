import { useState, useEffect } from 'react'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return { isFullscreen, toggle }
}
