import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type {
  ApiCandidateDetail,
  ApiMandate,
  ApiParliamentaryRecord,
  ApiPoliticalMandate,
} from '../shared/api.ts'
import { useCandidateDetail } from '../hooks/useCandidateDetail.ts'
import {
  EDITORIAL_THEMES,
  hasEvidence,
  tipoEvidenciaLabel,
} from '../shared/ficha.ts'
import { TEMA_LABEL } from '../shared/pautas.ts'
import { DEFAULT_TAB, TABS, type Tab } from '../shared/router.ts'
import { partyColor } from '../shared/party-colors.ts'
import { ageAtElection, formatBRL, formatDate } from '../lib/format.ts'
import { GooeyNav } from './GooeyNav.tsx'
import { LineSidebar, type SectionAnchor } from './LineSidebar.tsx'
import { Skeleton } from './ui/skeleton.tsx'
import './ficha.css'

interface CandidateDetailScreenProps {
  candidateId: string
  /** Ficha embutida no HTML pré-renderizado; dispensa a requisição à API. */
  initialData?: ApiCandidateDetail
  /** Aba viva; vem da query string (ver `src/shared/router.ts`). */
  tab: Tab
  onTabChange: (tab: Tab) => void
}

/**
 * Rótulo curto do item da dock e nome completo da aba.
 *
 * A dock é barra de texto: seis nomes completos não cabem na largura de uma
 * tela pequena. O item mostra o curto e a dica traz o nome por extenso.
 */
const TAB_META: Record<Tab, { short: string; full: string }> = {
  resumo: { short: 'Resumo', full: 'Resumo' },
  mandato: { short: 'Mandato', full: 'Mandato e histórico' },
  historico: { short: 'Histórico', full: 'Posições anteriores' },
  votacoes: { short: 'Votações', full: 'Votações-chave' },
  posicoes: { short: 'Posições', full: 'Posições editoriais' },
  fontes: { short: 'Fontes', full: 'Fontes' },
}

const SECTION_ID = {
  identificacao: 'identificacao',
  naturalidade: 'naturalidade',
  patrimonio: 'patrimonio',
  contato: 'contato',
  camara: 'camara',
  camaraMetricas: 'camara-metricas',
  senado: 'senado',
  cargos: 'cargos',
  votacoes: 'votacoes-chave',
  fontes: 'fontes',
} as const

function formatPeriod(
  dataInicio: string | null,
  dataFim: string | null,
): string {
  return [dataInicio, dataFim]
    .filter(Boolean)
    .map((date) => formatDate(date as string))
    .join(' — ')
}

function votoLabel(voto: string | null): string {
  if (voto === null) return 'Não registrou voto'
  return voto
}

function statusLabel(status: ApiPoliticalMandate['status']): string {
  return status === 'eleito' ? 'Eleito' : 'Suplente'
}

function totalDespesas(record: ApiParliamentaryRecord): number | null {
  const total = Object.values(record.despesasPorAno).reduce(
    (acc, item) => acc + item,
    0,
  )
  return total > 0 ? total : null
}

/**
 * Seção de conteúdo, com alvo de âncora.
 *
 * O `id` é o que o trilho lateral aponta e o que o IntersectionObserver
 * observa. `tabIndex={-1}` deixa a seção focável por script, para que o
 * clique no trilho possa mover o foco junto com a rolagem.
 */
function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="ficha-section"
      aria-labelledby={`${id}-titulo`}
      tabIndex={-1}
    >
      <h4 id={`${id}-titulo`} className="ficha-section__title">
        {title}
      </h4>
      {children}
    </section>
  )
}

function Campo({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/*
 * Uma função de âncoras por aba.
 *
 * Fica ao lado do componente que desenha a seção, e não numa tabela solta, para
 * que o trilho e o conteúdo derivem da mesma condição sobre o mesmo dado: a
 * aba do Senado só ganha seção quando há mandato no Senado, nos dois lugares.
 */

function resumoAnchors(): SectionAnchor[] {
  return [
    { id: SECTION_ID.identificacao, label: 'Identificação' },
    { id: SECTION_ID.naturalidade, label: 'Naturalidade' },
    { id: SECTION_ID.patrimonio, label: 'Bens e gastos' },
    { id: SECTION_ID.contato, label: 'Contato e redes' },
  ]
}

function mandatoAnchors(dado: ApiCandidateDetail): SectionAnchor[] {
  const parliamentary = dado.parliamentary
  if (!parliamentary || parliamentary.mandates.length === 0) return []

  const anchors: SectionAnchor[] = []
  if (parliamentary.mandates.some((m) => m.casa === 'camara')) {
    anchors.push({ id: SECTION_ID.camara, label: 'Deputado federal' })
    if (parliamentary.records.some((r) => r.casa === 'camara')) {
      anchors.push({
        id: SECTION_ID.camaraMetricas,
        label: 'Métricas da legislatura',
      })
    }
  }
  if (parliamentary.mandates.some((m) => m.casa === 'senado')) {
    anchors.push({ id: SECTION_ID.senado, label: 'Senador' })
  }
  return anchors
}

function historicoAnchors(dado: ApiCandidateDetail): SectionAnchor[] {
  if (dado.politicalMandates.length === 0) return []
  return [{ id: SECTION_ID.cargos, label: 'Cargos ocupados' }]
}

function votacoesAnchors(dado: ApiCandidateDetail): SectionAnchor[] {
  if ((dado.parliamentary?.votes ?? []).length === 0) return []
  return [{ id: SECTION_ID.votacoes, label: 'Votações registradas' }]
}

function posicoesAnchors(dado: ApiCandidateDetail): SectionAnchor[] {
  if (!dado.editorial) return []
  return EDITORIAL_THEMES.map((tema) => ({
    id: `posicao-${tema.id}`,
    label: tema.label,
  }))
}

function fontesAnchors(dado: ApiCandidateDetail): SectionAnchor[] {
  if (!dado.source.url) return []
  return [{ id: SECTION_ID.fontes, label: 'Links consultados' }]
}

function anchorsForTab(tab: Tab, dado: ApiCandidateDetail): SectionAnchor[] {
  switch (tab) {
    case 'resumo':
      return resumoAnchors()
    case 'mandato':
      return mandatoAnchors(dado)
    case 'historico':
      return historicoAnchors(dado)
    case 'votacoes':
      return votacoesAnchors(dado)
    case 'posicoes':
      return posicoesAnchors(dado)
    case 'fontes':
      return fontesAnchors(dado)
  }
}

/**
 * Índice da seção visível, para o trilho lateral acompanhar a rolagem.
 *
 * A faixa de observação é uma faixa horizontal (`rootMargin`) que pega só o
 * terço de cima da tela: assim a seção troca quando ela chega ali, e não
 * quando a borda inferior da viewport a encosta.
 */
function useActiveSection(ids: string[]): number {
  const [active, setActive] = useState(0)
  const visibleRef = useRef<Set<number>>(new Set())
  const key = ids.join('|')

  useEffect(() => {
    visibleRef.current = new Set()
    setActive(0)
    if (ids.length === 0) return

    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = ids.indexOf(entry.target.id)
          if (index < 0) continue
          if (entry.isIntersecting) visibleRef.current.add(index)
          else visibleRef.current.delete(index)
        }
        if (visibleRef.current.size === 0) return
        // A primeira visível manda: é a que o leitor está vendo.
        setActive(Math.min(...visibleRef.current))
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: 0 },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
    // `key` é a lista de ids decomposta: recria o observer quando a aba muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return Math.min(active, Math.max(ids.length - 1, 0))
}

function ResumoTab({ dado }: { dado: ApiCandidateDetail }) {
  const birthSource =
    dado.birthMunicipality && dado.birthState
      ? `${dado.birthMunicipality} (${dado.birthState})`
      : dado.birthState
  const age = ageAtElection(dado.birthDate)
  const candidacy = dado.federation
    ? `Federação: ${dado.federation}`
    : dado.candidacyType
  const bens = formatBRL(dado.totalAssets)
  const teto = formatBRL(dado.campaignSpendingCap)

  return (
    <div className="ficha-sections">
      <Section id={SECTION_ID.identificacao} title="Identificação">
        <dl>
          <Campo label="Nome completo" value={dado.fullName} />
          <Campo label="Número de urna" value={dado.ballotNumber} />
          <Campo
            label="Partido"
            value={dado.party ? `${dado.party}` : dado.partyAcronym}
          />
          <Campo label="Agremiação" value={candidacy} />
          <Campo label="Situação" value={dado.status ?? dado.campaignStatus} />
          <Campo label="Ocupação" value={dado.occupation} />
          <Campo label="Escolaridade" value={dado.education} />
          <Campo label="Estado civil" value={dado.maritalStatus} />
        </dl>
      </Section>

      <Section id={SECTION_ID.naturalidade} title="Naturalidade">
        <dl>
          <Campo
            label="Nascimento"
            value={dado.birthDate ? formatDate(dado.birthDate) : null}
          />
          <Campo label="Natural de" value={birthSource} />
          <Campo
            label="Idade na eleição"
            value={age !== null ? `${age} anos` : null}
          />
          <Campo label="Sexo" value={dado.gender} />
          <Campo label="Cor/raça" value={dado.race} />
          <Campo label="Quilombola" value={dado.quilombola ? 'Sim' : null} />
          <Campo label="Etnia indígena" value={dado.indigenousEthnicity} />
          <Campo
            label="Município"
            value={
              dado.city && dado.city.toUpperCase() !== 'PR' ? dado.city : null
            }
          />
          <Campo label="Nacionalidade" value={dado.nationality} />
        </dl>
      </Section>

      <Section id={SECTION_ID.patrimonio} title="Bens e gastos">
        <dl>
          <Campo label="Bens declarados" value={bens} />
          {dado.totalAssets === null && dado.assetsDeclared === false && (
            <Campo label="Bens" value="Não há declaração de bens no TSE" />
          )}
          <Campo label="Teto de gastos de campanha" value={teto} />
          <Campo
            label="Prestação de contas"
            value={
              dado.accountsDeclared === null
                ? null
                : dado.accountsDeclared
                  ? 'Declarada'
                  : 'Não declarada'
            }
          />
        </dl>
      </Section>

      <Section id={SECTION_ID.contato} title="Contato e redes">
        <dl>
          <Campo label="E-mail" value={dado.email} />
          {dado.socialLinks.length > 0 ? (
            <div>
              <dt>Redes sociais</dt>
              <dd>
                <ul>
                  {dado.socialLinks.map((link, index) => (
                    <li key={`${link}-${index}`}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : (
            <Campo
              label="Redes sociais"
              value="Nenhuma rede social informada"
            />
          )}
        </dl>
      </Section>
    </div>
  )
}

function MandatoTab({ dado }: { dado: ApiCandidateDetail }) {
  const parliamentary = dado.parliamentary
  if (!parliamentary || parliamentary.mandates.length === 0) {
    return (
      <div>
        <p>
          Não encontramos histórico parlamentar deste candidato na Câmara ou no
          Senado (2015–2026).
        </p>
        <p>
          <small>
            Os mandatos anteriores em outras posições políticas (vereador,
            prefeito, deputado estadual etc.) ficam na aba “Posições
            anteriores”.
          </small>
        </p>
      </div>
    )
  }

  const camaraMandates = parliamentary.mandates.filter(
    (m) => m.casa === 'camara',
  )
  const senadoMandates = parliamentary.mandates.filter(
    (m) => m.casa === 'senado',
  )
  const camaraRecord = parliamentary.records.find(
    (record) => record.casa === 'camara',
  )

  return (
    <div className="ficha-sections">
      {camaraMandates.length > 0 && (
        <Section id={SECTION_ID.camara} title="Deputado federal (Câmara)">
          <div>
            {camaraMandates.map((mandate) => (
              <MandatoItem
                key={`${mandate.casa}-${mandate.legislatura}`}
                mandate={mandate}
              />
            ))}
          </div>
        </Section>
      )}

      {camaraRecord && (
        <Section
          id={SECTION_ID.camaraMetricas}
          title="Atuação na legislatura atual (métricas)"
        >
          <CameraRecord record={camaraRecord} />
        </Section>
      )}

      {senadoMandates.length > 0 && (
        <Section id={SECTION_ID.senado} title="Senador (Senado)">
          <div>
            {senadoMandates.map((mandate) => (
              <MandatoItem
                key={`${mandate.casa}-${mandate.legislatura}`}
                mandate={mandate}
              />
            ))}
          </div>
          <p>
            <small>
              O Senado não expõe votações por API pública; registramos apenas o
              histórico de mandato nesta Casa.
            </small>
          </p>
        </Section>
      )}

      <p>
        <small>
          Presença em Plenário e emendas orçamentárias não têm API oficial da
          Câmara — não estão incluídas na ficha.
        </small>
      </p>
    </div>
  )
}

function HistoricoTab({ dado }: { dado: ApiCandidateDetail }) {
  const mandates = dado.politicalMandates
  if (mandates.length === 0) {
    return (
      <div>
        <p>
          Não encontramos registros de posições políticas anteriores deste
          candidato nas consultas do TSE (2004–2024) para o Paraná.
        </p>
        <p>
          <small>
            Consideramos mandatos eleitos e suplentes em todas as posições:
            vereador, prefeito, vice-prefeito, deputado estadual, deputado
            federal, senador, governador e vice-governador.
          </small>
        </p>
      </div>
    )
  }

  return (
    <div className="ficha-sections">
      <Section id={SECTION_ID.cargos} title="Posições políticas anteriores">
        <ol>
          {[...mandates]
            .sort((a, b) => a.ano - b.ano || a.cargo.localeCompare(b.cargo))
            .map((mandate) => {
              const lugar = mandate.municipio
                ? `${mandate.municipio}${mandate.uf ? `/${mandate.uf}` : ''}`
                : mandate.uf
              return (
                <li key={`${mandate.ano}-${mandate.cargo}-${mandate.turno}`}>
                  <p>
                    <strong>
                      {mandate.ano} · {mandate.cargo}
                    </strong>
                    {lugar && <span> · {lugar}</span>}
                    {mandate.partidoSigla && (
                      <span> · {mandate.partidoSigla}</span>
                    )}
                    {' — '}
                    <mark>{statusLabel(mandate.status)}</mark>
                  </p>
                  {mandate.turno > 1 && (
                    <p>
                      <small>2º turno</small>
                    </p>
                  )}
                </li>
              )
            })}
        </ol>
        <p>
          <small>
            Histórico montado com as consultas de candidatos das eleições de
            2004 a 2024 (TSE), incluindo eleitos e suplentes que tenham
            assumido.
          </small>
        </p>
      </Section>
    </div>
  )
}

function VotacoesTab({ dado }: { dado: ApiCandidateDetail }) {
  const votes = dado.parliamentary?.votes ?? []
  if (votes.length === 0) {
    return (
      <p>
        Não temos votações-chave registradas para este candidato (ele não tem
        histórico na Câmara ou usufruiu de votações sem registro nominal).
      </p>
    )
  }
  return (
    <div className="ficha-sections">
      <Section id={SECTION_ID.votacoes} title="Votações-chave na Câmara">
        <ol>
          {votes.map((vote) => (
            <li key={vote.votacaoId}>
              <p>
                <strong>{TEMA_LABEL[vote.tema] ?? vote.tema}</strong> —{' '}
                {vote.voto ? (
                  <mark>{votoLabel(vote.voto)}</mark>
                ) : (
                  <strong>{votoLabel(vote.voto)}</strong>
                )}
              </p>
              <p>
                <small>
                  {vote.rotulo} ({vote.proposicao}, {formatDate(vote.data)})
                </small>
              </p>
              <p>
                <small>
                  <a
                    href={`https://dadosabertos.camara.leg.br/api/v2/votacoes/${vote.votacaoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    registro oficial
                  </a>
                </small>
              </p>
            </li>
          ))}
        </ol>
        <p>
          <small>
            Votos extraídos dos registros nominais da Câmara. Quem não registrou
            voto pode não ter participado daquela votação ou estar ausente na
            data.
          </small>
        </p>
      </Section>
    </div>
  )
}

function PosicoesTab({ dado }: { dado: ApiCandidateDetail }) {
  const editorial = dado.editorial
  if (!editorial) {
    return (
      <p>Este candidato ainda não tem ficha editorial de posicionamento.</p>
    )
  }
  return (
    <div className="ficha-sections">
      {EDITORIAL_THEMES.map((tema) => {
        const campo = editorial[tema.id]
        const temEvidencia = hasEvidence(campo)
        /*
         * O `Section` já imprime o rótulo do tema como título. Repeitá-lo num
         * `<dt>` faria o leitor de tela anunciar o mesmo nome duas vezes, e
         * sobrava a `<dl>` de um item só.
         */
        return (
          <Section key={tema.id} id={`posicao-${tema.id}`} title={tema.label}>
            {temEvidencia ? (
              <>
                <p>{campo.valor}</p>
                <p>
                  <small>
                    Evidência: {tipoEvidenciaLabel(campo.tipo)}
                    {campo.fonte && (
                      <>
                        {' · '}
                        <a href={campo.fonte} target="_blank" rel="noreferrer">
                          fonte
                        </a>
                      </>
                    )}
                  </small>
                </p>
              </>
            ) : (
              <p>
                <em>Não encontrei evidência suficiente.</em>
              </p>
            )}
          </Section>
        )
      })}
    </div>
  )
}

function FontesTab({ dado }: { dado: ApiCandidateDetail }) {
  const fontes: Array<{ label: string; href: string }> = []
  if (dado.source.url) {
    fontes.push({
      label: `${dado.source.dataset} (${dado.source.provider})`,
      href: dado.source.url,
    })
  }
  for (const mandate of dado.parliamentary?.mandates ?? []) {
    fontes.push({
      label: `Página oficial — ${mandate.casa === 'camara' ? 'Câmara' : 'Senado'} (${mandate.nomeParlamentar})`,
      href:
        mandate.casa === 'camara'
          ? `https://www.camara.leg.br/deputados/${mandate.idParlamentar}`
          : `https://www25.senado.leg.br/web/senadores/-/senador/${mandate.idParlamentar}`,
    })
  }
  for (const vote of dado.parliamentary?.votes ?? []) {
    fontes.push({
      label: `Votação ${vote.proposicao} (${TEMA_LABEL[vote.tema] ?? vote.tema})`,
      href: `https://dadosabertos.camara.leg.br/api/v2/votacoes/${vote.votacaoId}`,
    })
  }
  for (const [tema, campo] of Object.entries(dado.editorial ?? {})) {
    if (hasEvidence(campo) && campo.fonte) {
      fontes.push({ label: `${tema}: ${campo.fonte}`, href: campo.fonte })
    }
  }

  if (fontes.length === 0) {
    return <p>Nenhuma fonte foi registrada para esta ficha.</p>
  }

  return (
    <div className="ficha-sections">
      <Section id={SECTION_ID.fontes} title="Links consultados">
        <p>
          <small>
            Lista de fontes usadas na ficha (dados oficiais + fontes das
            declarações editoriais).
          </small>
        </p>
        <ul>
          {fontes.map((fonte) => (
            <li key={fonte.href}>
              <a href={fonte.href} target="_blank" rel="noreferrer">
                {fonte.label}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function MandatoItem({ mandate }: { mandate: ApiMandate }) {
  return (
    <p>
      <strong>{mandate.legislatura}ª legislatura</strong>
      {mandate.partido && <span> · {mandate.partido}</span>}
      {mandate.uf && <span> · {mandate.uf}</span>} —{' '}
      <small>{formatPeriod(mandate.dataInicio, mandate.dataFim)}</small>
      {' · '}
      <a
        href={
          mandate.casa === 'camara'
            ? `https://www.camara.leg.br/deputados/${mandate.idParlamentar}`
            : `https://www25.senado.leg.br/web/senadores/-/senador/${mandate.idParlamentar}`
        }
        target="_blank"
        rel="noreferrer"
      >
        perfil oficial
      </a>
    </p>
  )
}

function CameraRecord({ record }: { record: ApiParliamentaryRecord }) {
  const total = Object.values(record.proposicoesPorAno).reduce(
    (acc, item) => acc + item,
    0,
  )
  return (
    <div>
      <dl>
        <Campo
          label="Proposições de autoria (2015–2026)"
          value={total > 0 ? String(total) : null}
        />
        {Object.keys(record.proposicoesPorAno).length > 0 && (
          <Campo
            label="Proposições por ano"
            value={Object.entries(record.proposicoesPorAno)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ano, quantidade]) => `${ano}: ${quantidade}`)
              .join(' · ')}
          />
        )}
        <Campo
          label="Comissões"
          value={
            record.comissoes.map((comissao) => comissao.sigla).join(', ') ||
            null
          }
        />
        <Campo
          label="Despesas reembolsadas (total)"
          value={formatBRL(totalDespesas(record))}
        />
        {Object.keys(record.despesasPorAno).length > 0 && (
          <Campo
            label="Despesas por ano"
            value={Object.entries(record.despesasPorAno)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ano, valor]) => `${ano}: ${formatBRL(valor)}`)
              .join(' · ')}
          />
        )}
      </dl>
      <p>
        <small>
          Despesas são os ressarcimentos registrados na Câmara (cota parlamentar
          e outras despesas do mandato) no período da legislatura.
        </small>
      </p>
    </div>
  )
}

function FichaStructure({
  dado,
  tab,
  onTabChange,
}: {
  dado: ApiCandidateDetail
  tab: Tab
  onTabChange: (tab: Tab) => void
}) {
  const candidate = dado
  const partido = partyColor(candidate.partyAcronym)
  const accent = partido.primary
  const anchors = useMemo(() => anchorsForTab(tab, dado), [tab, dado])
  const activeSection = useActiveSection(anchors.map((anchor) => anchor.id))

  /**
   * Trocar de aba troca todo o conteúdo de uma vez, então a rolagem volta ao
   * topo: sem isto a pessoa cai no meio da aba nova, bem abaixo da dock.
   */
  const changeTab = useCallback(
    (next: Tab) => {
      onTabChange(next)
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [onTabChange],
  )

  const gooeyItems = TABS.map((id) => ({
    id: `ficha-tab-${id}`,
    label: TAB_META[id].short,
    description: TAB_META[id].full,
    onClick: () => changeTab(id),
  }))

  const handleSectionClick = useCallback(
    (_index: number, item: SectionAnchor) => {
      const node = document.getElementById(item.id)
      if (!node) return
      const reduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      node.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      })
      node.focus({ preventScroll: true })
    },
    [],
  )

  /** Setas, Home e End movem entre abas, como manda o padrão de tablist. */
  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const current = TABS.indexOf(tab)
      let next = current
      if (event.key === 'ArrowRight') next = (current + 1) % TABS.length
      else if (event.key === 'ArrowLeft')
        next = (current - 1 + TABS.length) % TABS.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = TABS.length - 1
      else return

      event.preventDefault()
      const id = TABS[next]
      changeTab(id)
      requestAnimationFrame(() => {
        document.getElementById(`ficha-tab-${id}`)?.focus()
      })
    },
    [changeTab, tab],
  )

  return (
    <section className="ficha">
      <header className="ficha__cabecalho">
        {candidate.photoUrl && (
          <img
            src={candidate.photoUrl}
            alt={candidate.ballotName}
            width="120"
            height="150"
            loading="lazy"
          />
        )}
        <div>
          <h2>{candidate.ballotName}</h2>
          <p>
            {candidate.ballotNumber && (
              <span>Nº {candidate.ballotNumber} · </span>
            )}
            {candidate.partyAcronym ?? candidate.party ?? 'Sem partido'}
          </p>
          <p>
            <small>
              Candidato(a) a deputado(a) federal pelo Paraná — Eleições 2026
            </small>
          </p>
          {(candidate.isIncumbent ||
            candidate.isReelection ||
            candidate.parliamentary) && (
            <p>
              <mark>
                {candidate.isIncumbent
                  ? `Deputado(a) federal em exercício${candidate.camaraPartyAcronym ? ` (${candidate.camaraPartyAcronym})` : ''}`
                  : candidate.parliamentary
                    ? 'Tem histórico parlamentar'
                    : 'Em campanha de reeleição'}
              </mark>
            </p>
          )}
        </div>
      </header>

      {/* O `tablist` é o `<ul>` do GooeyNav; aqui só mora o teclado. */}
      <div className="ficha__nav" onKeyDown={handleTabKeyDown}>
        <GooeyNav
          items={gooeyItems}
          activeIndex={TABS.indexOf(tab)}
          accentColor={accent}
          ariaLabel="Abas da ficha"
        />
      </div>

      <div className="ficha__corpo">
        {anchors.length > 1 && (
          <aside className="ficha__trilho">
            <LineSidebar
              items={anchors}
              accentColor={accent}
              activeIndex={activeSection}
              onItemClick={handleSectionClick}
            />
          </aside>
        )}

        <div
          className="ficha__conteudo"
          id={`ficha-tab-${tab}-painel`}
          role="tabpanel"
          aria-labelledby={`ficha-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'resumo' && <ResumoTab dado={candidate} />}
          {tab === 'mandato' && <MandatoTab dado={candidate} />}
          {tab === 'historico' && <HistoricoTab dado={candidate} />}
          {tab === 'votacoes' && <VotacoesTab dado={candidate} />}
          {tab === 'posicoes' && <PosicoesTab dado={candidate} />}
          {tab === 'fontes' && <FontesTab dado={candidate} />}
        </div>
      </div>

      <p className="ficha__rodape">
        <small>
          Ficha comparável montada com dados oficiais (TSE, Câmara e Senado) e
          conteúdo editorial. O app não intepreta posições: o que não tem
          evidência aparece como “não encontrei evidência suficiente”.
        </small>
      </p>
    </section>
  )
}

export function CandidateDetailScreen({
  candidateId,
  initialData,
  tab = DEFAULT_TAB,
  onTabChange,
}: CandidateDetailScreenProps) {
  const { state, retry } = useCandidateDetail(candidateId, initialData)

  if (state.status === 'error') {
    return (
      <section>
        <p>Não foi possível carregar a ficha deste candidato.</p>
        <p>
          <small>({state.message})</small>
        </p>
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </section>
    )
  }

  if (state.status === 'loading') {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4"
      >
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </section>
    )
  }

  return (
    <FichaStructure dado={state.data} tab={tab} onTabChange={onTabChange} />
  )
}
