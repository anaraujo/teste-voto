/**
 * Clique com modificador —Cmd/Ctrl/Shift/Alt, ou botão que não é o principal—
 * pede ao navegador para abrir em nova aba. Nesse caso o app não intercepta e
 * não navega sozinho; só o clique simples vira rota interna.
 *
 * Compartilhado pelas telas que interceptam links de ficha, para que abrir em
 * nova aba funcione igual na lista e no resultado.
 */
export function isModifiedClick(event: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}
