import { useState } from 'react'
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
import { ageAtElection, formatBRL, formatDate } from '../lib/format.ts'

type Tab =
  'resumo' | 'mandato' | 'historico' | 'votacoes' | 'posicoes' | 'fontes'

interface CandidateDetailScreenProps {
  candidateId: string
  onBack: () => void
}

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

function FichaStructure({
  dado,
  onBack,
}: {
  dado: ApiCandidateDetail
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('resumo')
  const candidate = dado

  return (
    <section>
      <header>
        {candidate.photoUrl && (
          <img
            src={candidate.photoUrl}
            alt={candidate.ballotName}
            width="120"
            height="150"
            loading="lazy"
          />
        )}
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
      </header>

      <nav aria-label="Ficha do candidato">
        <button type="button" onClick={() => setTab('resumo')}>
          Resumo
        </button>
        <button type="button" onClick={() => setTab('mandato')}>
          Mandato e histórico
        </button>
        <button type="button" onClick={() => setTab('historico')}>
          Posições anteriores
        </button>
        <button type="button" onClick={() => setTab('votacoes')}>
          Votações
        </button>
        <button type="button" onClick={() => setTab('posicoes')}>
          Posições
        </button>
        <button type="button" onClick={() => setTab('fontes')}>
          Fontes
        </button>
      </nav>

      {tab === 'resumo' && <ResumoTab dado={candidate} />}
      {tab === 'mandato' && <MandatoTab dado={candidate} />}
      {tab === 'historico' && <HistoricoTab dado={candidate} />}
      {tab === 'votacoes' && <VotacoesTab dado={candidate} />}
      {tab === 'posicoes' && <PosicoesTab dado={candidate} />}
      {tab === 'fontes' && <FontesTab dado={candidate} />}

      <p>
        <small>
          Ficha comparável montada com dados oficiais (TSE, Câmara e Senado) e
          conteúdo editorial. O app não intepreta posições: o que não tem
          evidência aparece como “não encontrei evidência suficiente”.
        </small>
      </p>

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
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
        value={dado.city && dado.city.toUpperCase() !== 'PR' ? dado.city : null}
      />
      <Campo label="Nacionalidade" value={dado.nationality} />
      <Campo label="E-mail" value={dado.email} />
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
      {dado.socialLinks.length > 0 && (
        <div>
          <dt>Redes sociais</dt>
          <dd>
            <ul>
              {dado.socialLinks.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noreferrer">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
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

  return (
    <div>
      <h3>Histórico parlamentar</h3>

      {camaraMandates.length > 0 && (
        <>
          <h4>Deputado federal (Câmara)</h4>
          <div>
            {camaraMandates.map((mandate) => (
              <MandatoItem
                key={`${mandate.casa}-${mandate.legislatura}`}
                mandate={mandate}
              />
            ))}
          </div>
          <CameraRecord parliamentary={parliamentary} />
        </>
      )}

      {senadoMandates.length > 0 && (
        <>
          <h4>Senador (Senado)</h4>
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
        </>
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

function statusLabel(status: ApiPoliticalMandate['status']): string {
  return status === 'eleito' ? 'Eleito' : 'Suplente'
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
    <div>
      <h3>Posições políticas anteriores</h3>
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
          Histórico montado com as consultas de candidatos das eleições de 2004
          a 2024 (TSE), incluindo eleitos e suplentes que tenham assumido.
        </small>
      </p>
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

function CameraRecord({
  parliamentary,
}: {
  parliamentary: NonNullable<ApiCandidateDetail['parliamentary']>
}) {
  const camara = parliamentary.records.find(
    (record) => record.casa === 'camara',
  )
  if (!camara) return null
  const total = Object.values(camara.proposicoesPorAno).reduce(
    (acc, item) => acc + item,
    0,
  )
  return (
    <div>
      <h5>Atuação na legislatura atual (métricas)</h5>
      <dl>
        <Campo
          label="Proposições de autoria (2015–2026)"
          value={total > 0 ? String(total) : null}
        />
        {Object.keys(camara.proposicoesPorAno).length > 0 && (
          <Campo
            label="Proposições por ano"
            value={Object.entries(camara.proposicoesPorAno)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ano, quantidade]) => `${ano}: ${quantidade}`)
              .join(' · ')}
          />
        )}
        <Campo
          label="Comissões"
          value={
            camara.comissoes.map((comissao) => comissao.sigla).join(', ') ||
            null
          }
        />
        <Campo
          label="Despesas reembolsadas (total)"
          value={formatBRL(totalDespesas(camara))}
        />
        {Object.keys(camara.despesasPorAno).length > 0 && (
          <Campo
            label="Despesas por ano"
            value={Object.entries(camara.despesasPorAno)
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

function totalDespesas(record: ApiParliamentaryRecord): number | null {
  const total = Object.values(record.despesasPorAno).reduce(
    (acc, item) => acc + item,
    0,
  )
  return total > 0 ? total : null
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
    <div>
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
    <dl>
      {EDITORIAL_THEMES.map((tema) => {
        const campo = editorial[tema.id]
        const temEvidencia = hasEvidence(campo)
        return (
          <div key={tema.id}>
            <dt>{tema.label}</dt>
            <dd>
              {temEvidencia ? (
                <>
                  <p>{campo.valor}</p>
                  <p>
                    <small>
                      Evidência: {tipoEvidenciaLabel(campo.tipo)}
                      {campo.fonte && (
                        <>
                          {' · '}
                          <a
                            href={campo.fonte}
                            target="_blank"
                            rel="noreferrer"
                          >
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
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function FontesTab({ dado }: { dado: ApiCandidateDetail }) {
  const fontes: Array<{ label: string; href: string }> = [
    {
      label: `${dado.source.dataset} (${dado.source.provider})`,
      href: dado.source.url,
    },
  ]
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

  return (
    <div>
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
    </div>
  )
}

export function CandidateDetailScreen({
  candidateId,
  onBack,
}: CandidateDetailScreenProps) {
  const { state, retry } = useCandidateDetail(candidateId)

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
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </section>
    )
  }

  if (state.status === 'loading') {
    return (
      <section>
        <p>Carregando ficha...</p>
      </section>
    )
  }

  return <FichaStructure dado={state.data} onBack={onBack} />
}
