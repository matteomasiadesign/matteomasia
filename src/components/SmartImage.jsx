import React, { useState, useRef, useEffect } from 'react'

/**
 * SmartImage: Immagine con transizione morbida (blur-up / fade-in)
 * e placeholder discreto durante il caricamento, per eliminare salti visivi.
 */
export default function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  isDark = true,
  loading = 'lazy',
  ...rest
}) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    // Se l'immagine è già in cache del browser, impostiamo loaded a true immediatamente
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Sfondo Skeleton / Placeholder */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          loaded ? 'opacity-0' : 'opacity-100'
        } ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}
        aria-hidden="true"
      >
        <div className="w-full h-full animate-pulse bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
      </div>

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm scale-[1.02]'
        } ${imgClassName}`}
        {...rest}
      />
    </div>
  )
}

