import { useEffect, useRef } from 'react'

/** Tracks which keys are held down, by `KeyboardEvent.code` (e.g. "KeyW"). */
export function useKeyboard() {
  const pressed = useRef(new Set<string>())

  useEffect(() => {
    const keys = pressed.current
    const down = (e: KeyboardEvent) => keys.add(e.code)
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const clear = () => keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return pressed
}
