/**
 * Rótulos legíveis dos cargos que o TSE devolve no histórico de posições.
 *
 * Vive em `shared/` porque serve tanto ao servidor (export da ficha) quanto
 * ao app (a aba "Posições anteriores"). Os valores crus vêm em maiúsculas
 * ("SENADOR", "GOVERNADOR", "1º SUPLENTE") e aqui ganham a forma de título.
 */

const CARGO_LABEL: Record<string, string> = {
  vereador: 'Vereador',
  prefeito: 'Prefeito',
  'vice-prefeito': 'Vice-prefeito',
  'deputado estadual': 'Deputado estadual',
  'deputado distrital': 'Deputado distrital',
  'deputado federal': 'Deputado federal',
  senador: 'Senador',
  governador: 'Governador',
  'vice-governador': 'Vice-governador',
  presidente: 'Presidente',
  'vice-presidente': 'Vice-presidente',
  '1º suplente': '1º suplente de senador',
  '2º suplente': '2º suplente de senador',
}

/** Rótulo legível do cargo (para exibição/export). */
export function formatCargoLabel(cargo: string): string {
  return CARGO_LABEL[cargo.toLowerCase()] ?? cargo
}
