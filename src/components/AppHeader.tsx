import { parentPath, showsBackButton, type Route } from '../shared/router.ts'

interface AppHeaderProps {
  route: Route
  onNavigate: (to: string) => void
}

/**
 * Cabeçalho com o botão de voltar. O destino é determinístico (ver
 * `parentPath`), então o botão nunca depende de um histórico guardado em estado.
 */
export function AppHeader({ route, onNavigate }: AppHeaderProps) {
  if (!showsBackButton(route)) return null

  const target = parentPath(route)
  const label = target === '/' ? 'Início' : 'Voltar'

  return (
    <header>
      <button type="button" onClick={() => onNavigate(target)}>
        ← {label}
      </button>
    </header>
  )
}
