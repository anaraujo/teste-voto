/**
 * Modelo da ficha comparável por candidato, na parte editorial.
 *
 * A ficha separa o que é fatos oficiais (TSE, Câmara, Senado — gravados no
 * banco) do que o candidato afirma (posições, propostas — conteúdo editorial,
 * em content/editorial/<id>.json). Cada campo editorial carrega o tipo de
 * evidência e a fonte; quando não há evidência, o valor é vazio e o tipo é
 * 'sem-evidencia' -> o app mostra "não encontrei evidência suficiente".
 */

export type TipoEvidencia =
  | 'proposta'
  | 'declaracao'
  | 'historico'
  | 'sem-evidencia'

export interface EditorialField {
  /** Texto da posição/proposta. Vazio = não encontramos evidência. */
  valor: string
  tipo: TipoEvidencia
  /** URL da fonte (obrigatória quando há evidência). */
  fonte: string | null
}

export interface EditorialFicha {
  campos: Partial<Record<string, EditorialField>>
  updatedAt: string | null
}

export interface EditorialTema {
  id: string
  label: string
}

/** Agendas de posicionamento da ficha (campos editoriais). */
export const EDITORIAL_THEMES: readonly EditorialTema[] = [
  { id: 'principais-propostas', label: 'Principais propostas' },
  { id: 'saude', label: 'Saúde' },
  { id: 'educacao', label: 'Educação' },
  { id: 'seguranca', label: 'Segurança pública' },
  { id: 'economia', label: 'Economia e tributação' },
  { id: 'meio-ambiente', label: 'Meio ambiente e clima' },
  { id: 'trabalho', label: 'Trabalho e previdência' },
  { id: 'ciencia-tecnologia', label: 'Ciência e tecnologia' },
  { id: 'cultura', label: 'Cultura' },
  { id: 'posicionamentos', label: 'Posicionamentos declarados' },
]

const TIPO_LABEL: Record<TipoEvidencia, string> = {
  proposta: 'Proposta',
  declaracao: 'Declaração',
  historico: 'Histórico parlamentar',
  'sem-evidencia': 'Sem evidência',
}

export function tipoEvidenciaLabel(tipo: string | undefined): string {
  if (tipo && tipo in TIPO_LABEL) return TIPO_LABEL[tipo as TipoEvidencia]
  return TIPO_LABEL['sem-evidencia']
}

/** Campo editorial vazio (usado nos templates e na leitura). */
export function emptyField(): EditorialField {
  return { valor: '', tipo: 'sem-evidencia', fonte: null }
}

/** Vazio é exibido como "não encontrei evidência suficiente". */
export function hasEvidence(
  field: { valor: string; tipo: string } | undefined,
): boolean {
  return Boolean(field && field.valor.trim() !== '' && field.tipo !== 'sem-evidencia')
}

export function emptyEditorialFicha(): EditorialFicha {
  const campos: EditorialFicha['campos'] = {}
  for (const tema of EDITORIAL_THEMES) {
    campos[tema.id] = emptyField()
  }
  return { campos, updatedAt: null }
}