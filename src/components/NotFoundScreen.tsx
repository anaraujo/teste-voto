import { SpecularButton } from './SpecularButton.tsx'

interface NotFoundScreenProps {
  path: string
  onHome: () => void
}

export function NotFoundScreen({ path, onHome }: NotFoundScreenProps) {
  return (
    <section>
      <h2>Página não encontrada</h2>
      <p>
        Não encontramos nada em <code>{path}</code>.
      </p>
      <SpecularButton variant="primary" size="md" onClick={onHome}>
        Ir para o início
      </SpecularButton>
    </section>
  )
}
