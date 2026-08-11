import { useCallback, useEffect, useRef, useState } from 'react'

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________'

// Adattamento React del componente "Scramble / Decode Text" (The Site).
// Preserva gli spazi cosi' i testi multi-parola non collassano in un blob di simboli.
export const ScrambleText = ({ text, as: Tag = 'span', className = '', scrambleOnMount = true, ...props }) => {
  const [display, setDisplay] = useState(text)
  const frameRef = useRef(null)

  const scramble = useCallback(() => {
    let iteration = 0
    cancelAnimationFrame(frameRef.current)

    const run = () => {
      setDisplay(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' '
            if (i < iteration) return text[i]
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
          })
          .join('')
      )

      if (iteration < text.length) {
        iteration += 1 / 3
        frameRef.current = requestAnimationFrame(run)
      }
    }

    run()
  }, [text])

  useEffect(() => {
    if (scrambleOnMount) scramble()
    return () => cancelAnimationFrame(frameRef.current)
  }, [scramble, scrambleOnMount])

  return (
    <Tag className={className} onMouseEnter={scramble} {...props}>
      {display}
    </Tag>
  )
}
