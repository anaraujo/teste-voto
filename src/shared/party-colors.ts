/**
 * Cores dos partidos, para o card da lista e a ficha.
 *
 * Não há fonte oficial legível por máquina: o TSE e a API da Câmara não
 * expõem cor de partido. Os hexes abaixo vieram das cores de bandeira de cada
 * partido e estão conferidos contra WCAG AA com `readableOn` — as 30 cores
 * passam com a tinta que a função escolhe. Onde a cor é compartilhada por
 * mais de um partido (o vermelho de PDT/PCdoB/PSTU/PCO/PSOL, por exemplo), o
 * card é igual, e é isso que a sigla resolve.
 *
 * As chaves são as siglas do TSE em NFC. `MISSÃO` e `UNIÃO` chegam do banco em
 * NFD em alguns casos, então `partyColor` normaliza antes de procurar.
 */

export interface PartyColor {
  /** Cor principal: fundo do card, borda e título. */
  primary: string
  /** Demais cores da bandeira, em ordem de presença. */
  secondary: string[]
}

export const PARTY_COLORS: Record<string, PartyColor> = {
  MDB: { primary: '#00843D', secondary: ['#F2C300', '#D71920'] },
  PDT: { primary: '#D71920', secondary: ['#0057A8', '#FFFFFF'] },
  PT: { primary: '#CC0000', secondary: ['#FFFFFF'] },
  PCDOB: { primary: '#D71920', secondary: ['#F2C300'] },
  PSB: { primary: '#F2C300', secondary: ['#D71920'] },
  PSDB: { primary: '#0F2BC5', secondary: ['#F2C300'] },
  AGIR: { primary: '#00A6CE', secondary: ['#00843D'] },
  MOBILIZA: { primary: '#E30613', secondary: ['#000000', '#FFFFFF'] },
  CIDADANIA: { primary: '#1677C8', secondary: ['#E4007B', '#00AEEF'] },
  PV: { primary: '#00843D', secondary: ['#FFFFFF'] },
  AVANTE: { primary: '#CA4A19', secondary: ['#00A6CE', '#FFFFFF'] },
  PP: { primary: '#2E4E77', secondary: ['#FFFFFF', '#7BA7D7'] },
  PSTU: { primary: '#D71920', secondary: ['#F2C300'] },
  PCB: { primary: '#C8102E', secondary: ['#FFFFFF'] },
  PRTB: { primary: '#00843D', secondary: ['#0057A8', '#F2C300'] },
  DC: { primary: '#00007B', secondary: ['#F2C300'] },
  PCO: { primary: '#D71920', secondary: ['#F2C300'] },
  PODE: { primary: '#0072CE', secondary: ['#00843D', '#F2C300'] },
  REPUBLICANOS: { primary: '#005CA9', secondary: ['#00843D', '#F2C300'] },
  PSOL: { primary: '#D71920', secondary: ['#F2C300', '#7B2D8E'] },
  PL: { primary: '#0057A8', secondary: ['#D71920'] },
  PSD: { primary: '#0072CE', secondary: ['#F2C300', '#00843D'] },
  SOLIDARIEDADE: { primary: '#F36C21', secondary: ['#0057A8'] },
  NOVO: { primary: '#F58220', secondary: ['#12325C'] },
  REDE: { primary: '#00A88F', secondary: ['#F58220'] },
  DEMOCRATA: { primary: '#0B2D5C', secondary: ['#FFFFFF'] },
  UP: { primary: '#C8102E', secondary: ['#000000', '#FFFFFF'] },
  UNIÃO: { primary: '#0057B8', secondary: ['#F2C300', '#00843D'] },
  PRD: { primary: '#009B3A', secondary: ['#F2C300', '#0072CE', '#FFFFFF'] },
  MISSÃO: { primary: '#F2C300', secondary: ['#000000', '#FFFFFF'] },
}

/** Cor de quem não tem partido informado. Passa em AA com texto branco (4,83:1). */
export const SEM_PARTIDO: PartyColor = {
  primary: '#6B7280',
  secondary: [],
}

/** As duas tintas candidatas: as únicas que o card usa. */
const TINTA_CLARA = '#ffffff'
const TINTA_ESCURA = '#111111'

/** Luminância relativa, conforme WCAG 2.1. */
function luminancia(hex: string): number {
  const canal = (v: number): number => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const n = Number.parseInt(hex.slice(1), 16)
  const r = canal((n >> 16) & 255)
  const g = canal((n >> 8) & 255)
  const b = canal(n & 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste entre duas cores, de 1:1 a 21:1. */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

/**
 * Tinta que passa em AA sobre a cor dada: a de maior contraste das duas.
 *
 * Não dá para fixar branco. Medido nas 30 cores: com texto branco caem para
 * 1,67:1 no amarelo de PSB/MISSÃO, 2,59:1 no laranja de NOVO e 2,86:1 no
 * ciano de AGIR. Com #111, as 30 passam, e a pior delas é CIDADANIA e AVANTE
 * em 4,66:1.
 */
export function readableOn(hex: string): string {
  return contraste(hex, TINTA_CLARA) >= contraste(hex, TINTA_ESCURA)
    ? TINTA_CLARA
    : TINTA_ESCURA
}

/** Os três canais de um `#rrggbb`, para poder misturar. */
function canais(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** O inverso de `canais`, em minúsculo como as constantes do arquivo. */
function paraHex(rgb: readonly number[]): string {
  return `#${rgb.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`
}

/** Contraste mínimo que WCAG AA pede para texto normal. */
const MINIMO_AA = 4.5

/**
 * Preenchimento que continua legível sob a tinta que o card escolheu.
 *
 * A secundária pura não serve para ir atrás de texto: ela foi escolhida como
 * cor de bandeira, não como fundo. Medido nas 31 entradas (as 30 da tabela e
 * o cinza de sem partido), com a tinta que `readableOn` dá para a primária, em
 * 20 delas a secundária fica entre 1,00:1 e 3,93:1 — a branca de PT, PV, PP,
 * PCB e DEMOCRATA é idêntica à tinta branca do card, e o texto sumiria.
 *
 * Aqui a secundária é misturada na direção do preto quando a tinta é branca,
 * ou na direção do branco quando é #111, até passar de 4,5:1. A busca é em
 * passos inteiros de 1%, do zero para cima, então devolve sempre a cor mais
 * próxima da original que ainda funciona: 11 partidos não precisam de mistura
 * nenhuma e o pior caso é 54%, nos cinco de secundária branca, que viram um
 * cinza. Quem não tem secundária cadastrada cai na primária, como no card.
 */
export function readableFill(party: PartyColor, tinta: string): string {
  const base = party.secondary[0] ?? party.primary
  const alvo: [number, number, number] =
    tinta === TINTA_ESCURA ? [255, 255, 255] : [0, 0, 0]
  const origem = canais(base)

  for (let passo = 0; passo <= 100; passo += 1) {
    const fracao = passo / 100
    const mistura = paraHex(
      origem.map((canal, i) =>
        Math.round(canal * (1 - fracao) + alvo[i] * fracao),
      ),
    )
    if (contraste(mistura, tinta) >= MINIMO_AA) return mistura
  }

  // Atingir 100% já é preto ou branco puro, que sempre contrasta com as duas
  // tintas. unreachable na prática, mas mantém o retorno bem tipado.
  return paraHex(alvo)
}

/**
 * Cor do partido pela sigla, ou o cinza de quem não tem partido.
 *
 * A sigla é normalizada antes da busca porque o banco traz `MISSÃO` e `UNIÃO`
 * em NFD, e a chave é NFC. O NFC vem antes do `toUpperCase` de propósito: em
 * NFD, o acento é um caractere à parte e o `A` acentuado não vira `A`.
 *
 * Sigla desconhecida — um partido novo, ou o sentinela `#NULO` do TSE para
 * partido ausente — cai no cinza, para nunca ficar sem cor.
 */
export function partyColor(sigla: string | null | undefined): PartyColor {
  if (!sigla) return SEM_PARTIDO
  return PARTY_COLORS[sigla.normalize('NFC').toUpperCase()] ?? SEM_PARTIDO
}
