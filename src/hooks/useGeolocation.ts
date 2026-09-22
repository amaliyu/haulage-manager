import { useCallback, useState } from 'react'
import { roundCoord } from '@/lib/zod'

export type Position = { latitude: number; longitude: number; accuracy: number }

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = useCallback((): Promise<Position | null> => {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('This device cannot share its location.')
      return Promise.resolve(null)
    }
    setLoading(true)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false)
          resolve({
            latitude: roundCoord(pos.coords.latitude),
            longitude: roundCoord(pos.coords.longitude),
            accuracy: Math.round(pos.coords.accuracy),
          })
        },
        (err) => {
          setLoading(false)
          setError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was refused. Allow location for this site in your browser settings.'
              : err.code === err.TIMEOUT
                ? 'Getting your location took too long. Move outside and try again.'
                : 'Your location is not available right now. Try again.',
          )
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      )
    })
  }, [])

  return { locate, loading, error }
}
