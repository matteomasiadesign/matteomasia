import { useEffect, useState } from 'react'

// Ora locale di Porto Torres (fuso di Roma), es. "14:32". Si aggiorna allo
// scoccare di ogni minuto.
const fmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

export function useLocalTime() {
  const [time, setTime] = useState(() => fmt.format(new Date()))

  useEffect(() => {
    let timer = 0
    const tick = () => {
      setTime(fmt.format(new Date()))
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    }
    timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    return () => clearTimeout(timer)
  }, [])

  return time
}
