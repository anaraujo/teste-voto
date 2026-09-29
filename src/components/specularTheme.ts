export type SpecularVariant = 'primary' | 'secondary'

/**
 * Cores do SpecularButton, por variante. As variantes compartilham o mesmo
 * estilo estrutural; apenas as cores mudam.
 *
 * Fonte única das cores: os tokens declarados em src/index.css (@theme —
 * var(--color-primary), var(--color-primary-soft), etc.). O shader WebGL
 * precisa dos valores em runtime, por isso resolvemos as variáveis CSS com
 * getComputedStyle. Os hexes em FALLBACK existem apenas como segurança caso a
 * variável CSS não esteja disponível. Documentação: docs/design-tokens.md
 */
export interface SpecularTheme {
  /** Cor do vidro de fundo (tint). */
  tint: string
  /** Opacidade do vidro de fundo. */
  tintOpacity: number
  /** Blur do fundo atrás do botão, em px. */
  blur: number
  /** Cor do rótulo. */
  textColor: string
  /** Cor do brilho especular em movimento. */
  lineColor: string
  /** Cor do contorno estático sob o brilho. */
  baseColor: string
  /** Raio dos cantos em px (clampa em pill automaticamente). */
  radius: number
}

/** Mapeamento variante → tokens de cor declarados em src/index.css. */
const TOKENS: Record<SpecularVariant, { tint: string; text: string }> = {
  primary: { tint: '--color-primary-soft', text: '--color-primary' },
  secondary: { tint: '--color-secondary-soft', text: '--color-secondary' },
}

/** Fallback de segurança (hexes) caso a variável CSS não exista no runtime. */
const FALLBACK: Record<SpecularVariant, SpecularTheme> = {
  primary: {
    tint: '#069400',
    tintOpacity: 0.25,
    blur: 11,
    textColor: '#009739',
    lineColor: '#009739',
    baseColor: '#069400',
    radius: 16,
  },
  secondary: {
    tint: '#fb3f13',
    tintOpacity: 0.25,
    blur: 11,
    textColor: '#f59e0b',
    lineColor: '#f59e0b',
    baseColor: '#fb3f13',
    radius: 16,
  },
}

function readCssVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

const cache = new Map<SpecularVariant, SpecularTheme>()

/**
 * Resolve o tema da variante lendo os tokens de cor do CSS (fonte única).
 * O resultado é cacheado por variante: a resolução acontece uma única vez.
 */
export function getSpecularTheme(variant: SpecularVariant): SpecularTheme {
  const cached = cache.get(variant)
  if (cached) return cached

  const fallback = FALLBACK[variant] ?? FALLBACK.primary
  const tokens = TOKENS[variant] ?? TOKENS.primary
  const tint = readCssVar(tokens.tint) || fallback.tint
  const text = readCssVar(tokens.text) || fallback.textColor
  const theme: SpecularTheme = {
    ...fallback,
    tint,
    textColor: text,
    lineColor: text,
    baseColor: tint,
  }
  cache.set(variant, theme)
  return theme
}
