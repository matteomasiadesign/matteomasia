import { useCallback, useEffect, useRef, useState } from 'react'

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________'
const randomChar = () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]

// Costruisce la timeline: ogni carattere "reale" occupa `letterDurationMs`,
// gli spazi vengono attraversati all'istante cosi' non rallentano la sequenza.
const buildSchedule = (text, letterDurationMs) => {
  let cursor = 0
  return text.split('').map((char) => {
    const start = cursor
    const duration = char === ' ' ? 0 : letterDurationMs
    cursor += duration
    return { char, start, duration }
  })
}

// Adattamento React del componente "Scramble / Decode Text" (The Site).
// Al trigger, rivela il testo lettera per lettera da sinistra a destra:
// ogni carattere decodifica per `letterDurationMs` prima di bloccarsi su
// quello reale e far partire il successivo. A rivelazione conclusa, un
// hover ridecodifica l'intera parola rapidamente (come l'effetto originale).
export const ScrambleText = ({
  text,
  as: Tag = 'span',
  className = '',
  trigger = true,
  letterDurationMs = 1000,
  hoverScramble = true,
  ...props
}) => {
  const [chars, setChars] = useState(() => text.split('').map((char) => ({ display: char, revealed: false })))
  const [introDone, setIntroDone] = useState(false)
  const frameRef = useRef(null)
  const hasIntroStarted = useRef(false)

  const runIntro = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    const schedule = buildSchedule(text, letterDurationMs)
    const totalDuration = schedule.reduce((max, s) => Math.max(max, s.start + s.duration), 0)
    const startTime = performance.now()

    const tick = (now) => {
      const elapsed = now - startTime
      setChars(
        schedule.map(({ char, start, duration }) => {
          if (char === ' ') return { display: ' ', revealed: true }
          if (elapsed >= start + duration) return { display: char, revealed: true }
          if (elapsed >= start) return { display: randomChar(), revealed: true }
          return { display: char, revealed: false }
        })
      )
      if (elapsed < totalDuration) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setIntroDone(true)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [text, letterDurationMs])

  const runQuickScramble = useCallback(() => {
    if (!introDone) return
    cancelAnimationFrame(frameRef.current)
    let iteration = 0
    const letters = text.split('')

    const tick = () => {
      setChars(
        letters.map((char, i) => ({
          display: char === ' ' ? ' ' : i < iteration ? char : randomChar(),
          revealed: true,
        }))
      )
      if (iteration < letters.length) {
        iteration += 1 / 3
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    tick()
  }, [text, introDone])

  useEffect(() => {
    if (trigger && !hasIntroStarted.current) {
      hasIntroStarted.current = true
      runIntro()
    }
    return () => cancelAnimationFrame(frameRef.current)
  }, [trigger, runIntro])

  return (
    <Tag className={className} onMouseEnter={hoverScramble ? runQuickScramble : undefined} {...props}>
      {chars.map((c, i) => (
        <span key={i} style={{ opacity: c.revealed ? 1 : 0 }}>
          {c.display}
        </span>
      ))}
    </Tag>
  )
}
