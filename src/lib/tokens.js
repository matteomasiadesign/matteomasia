// Token di colore centralizzati, identici a quelli della landing originale.
// Così Home, Progetti e Admin restano sempre coerenti.
export function getTokens(isDark) {
  return {
    cBgRoot: isDark ? 'bg-black' : 'bg-[#e5e5ea]',
    cBgMain: isDark ? 'bg-[#000000]' : 'bg-[#f5f5f7]',
    cBgSec: isDark ? 'bg-[#111111]' : 'bg-[#ffffff]',
    cTextMain: isDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]',
    cTextMuted: 'text-[#86868b]',
    cBorder: isDark ? 'border-white/10' : 'border-black/10',
    cCard: isDark ? 'bg-[#1d1d1f]' : 'bg-[#ffffff]',
    cBtnBgPrimary: isDark ? 'bg-white text-black' : 'bg-[#1d1d1f] text-white',
    cBtnBgSecondary: isDark ? 'bg-[#1d1d1f] text-white' : 'bg-[#e8e8ed] text-black',
    cGlass: isDark ? 'bg-black/70 border-white/10' : 'bg-white/70 border-black/10',
  }
}

// Stile input coerente con la classe .apple-input della landing:
// fondo translucido, focus neutro morbido (niente blu).
export function inputClass(isDark) {
  return [
    'w-full rounded-xl px-4 py-3 text-base outline-none transition-all',
    isDark ? 'bg-white/5 text-white border border-white/10' : 'bg-black/[0.03] text-black border border-black/10',
    isDark ? 'focus:bg-white/[0.08] focus:border-white/30 focus:ring-4 focus:ring-white/5' : 'focus:bg-black/[0.05] focus:border-black/30 focus:ring-4 focus:ring-black/5',
    'placeholder:text-[#86868b]',
  ].join(' ')
}
