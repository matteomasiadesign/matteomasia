import React, { useState } from 'react'

// Immagine con placeholder e dissolvenza morbida quando finisce di caricare.
// Dà l'effetto "blur-up" senza bisogno di generare anteprime extra.
export default function SmartImage({ src, alt = '', className = '', imgClassName = '', isDark = true, ...rest }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${loaded ? 'opacity-0' : 'opacity-100'} ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 animate-pulse" />
      </div>
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`${imgClassName} transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-[1.02]'}`}
        {...rest}
      />
    </div>
  )
}
