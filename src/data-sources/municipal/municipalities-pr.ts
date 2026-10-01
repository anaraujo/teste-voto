/**
 * Os 55 municípios do Paraná que aparecem no histórico de vereador dos 428
 * candidatos (`political_mandates`, cargo `VEREADOR`).
 *
 * Tabela estática de propósito: `sync:municipal-registry` não deve depender
 * de rede para saber em que município estamos, e `npm test` precisa rodar sem
 * internet. Os códigos vêm da API de localidades do IBGE
 * (`/api/v1/localidades/municipios`) e foram conferidos um a um.
 *
 * A lista tem 55 entradas, e não as 59 que aparecem no histórico, porque o
 * TSE grava o mesmo município em duas grafias: `SAO MATEUS DO SUL` (2004) e
 * `SÃO MATEUS DO SUL` (2008 em diante). É a tabela de normalização que
 * resolve isso — ver `normalizeMunicipalityName`.
 *
 * Total de 169 candidatos-vereador cobertos por estes municípios.
 */

export interface PrMunicipality {
  /** Código IBGE de 7 dígitos. */
  ibgeCode: string
  /** Nome oficial do IBGE, com acentuação. */
  name: string
  state: string
}

export const PR_MUNICIPALITIES: readonly PrMunicipality[] = [
  { ibgeCode: '4100301', name: 'Agudos do Sul', state: 'PR' },
  { ibgeCode: '4100400', name: 'Almirante Tamandaré', state: 'PR' },
  { ibgeCode: '4100608', name: 'Alto Paraná', state: 'PR' },
  { ibgeCode: '4101101', name: 'Andirá', state: 'PR' },
  { ibgeCode: '4101408', name: 'Apucarana', state: 'PR' },
  { ibgeCode: '4101804', name: 'Araucária', state: 'PR' },
  { ibgeCode: '4102307', name: 'Balsa Nova', state: 'PR' },
  { ibgeCode: '4102406', name: 'Bandeirantes', state: 'PR' },
  { ibgeCode: '4103602', name: 'Cambará', state: 'PR' },
  { ibgeCode: '4103701', name: 'Cambé', state: 'PR' },
  { ibgeCode: '4104204', name: 'Campo Largo', state: 'PR' },
  { ibgeCode: '4104253', name: 'Campo Magro', state: 'PR' },
  { ibgeCode: '4104303', name: 'Campo Mourão', state: 'PR' },
  { ibgeCode: '4104808', name: 'Cascavel', state: 'PR' },
  { ibgeCode: '4104907', name: 'Castro', state: 'PR' },
  { ibgeCode: '4105508', name: 'Cianorte', state: 'PR' },
  { ibgeCode: '4105706', name: 'Clevelândia', state: 'PR' },
  { ibgeCode: '4105805', name: 'Colombo', state: 'PR' },
  { ibgeCode: '4105904', name: 'Colorado', state: 'PR' },
  { ibgeCode: '4106407', name: 'Cornélio Procópio', state: 'PR' },
  { ibgeCode: '4106506', name: 'Coronel Vivida', state: 'PR' },
  { ibgeCode: '4106902', name: 'Curitiba', state: 'PR' },
  { ibgeCode: '4107652', name: 'Fazenda Rio Grande', state: 'PR' },
  { ibgeCode: '4108304', name: 'Foz do Iguaçu', state: 'PR' },
  { ibgeCode: '4108320', name: 'Francisco Alves', state: 'PR' },
  { ibgeCode: '4109302', name: 'Guaraniaçu', state: 'PR' },
  { ibgeCode: '4109401', name: 'Guarapuava', state: 'PR' },
  { ibgeCode: '4109807', name: 'Ibiporã', state: 'PR' },
  { ibgeCode: '4113007', name: 'Jussara', state: 'PR' },
  { ibgeCode: '4113700', name: 'Londrina', state: 'PR' },
  { ibgeCode: '4114708', name: 'Maria Helena', state: 'PR' },
  { ibgeCode: '4115200', name: 'Maringá', state: 'PR' },
  { ibgeCode: '4115705', name: 'Matinhos', state: 'PR' },
  { ibgeCode: '4117305', name: 'Ortigueira', state: 'PR' },
  { ibgeCode: '4118204', name: 'Paranaguá', state: 'PR' },
  { ibgeCode: '4118402', name: 'Paranavaí', state: 'PR' },
  { ibgeCode: '4118501', name: 'Pato Branco', state: 'PR' },
  { ibgeCode: '4119152', name: 'Pinhais', state: 'PR' },
  { ibgeCode: '4119509', name: 'Piraquara', state: 'PR' },
  { ibgeCode: '4119608', name: 'Pitanga', state: 'PR' },
  { ibgeCode: '4119905', name: 'Ponta Grossa', state: 'PR' },
  { ibgeCode: '4119954', name: 'Pontal do Paraná', state: 'PR' },
  { ibgeCode: '4120903', name: 'Quedas do Iguaçu', state: 'PR' },
  { ibgeCode: '4121257', name: 'Ramilândia', state: 'PR' },
  { ibgeCode: '4122404', name: 'Rolândia', state: 'PR' },
  { ibgeCode: '4125506', name: 'São José dos Pinhais', state: 'PR' },
  { ibgeCode: '4125605', name: 'São Mateus do Sul', state: 'PR' },
  { ibgeCode: '4126207', name: 'Sapopema', state: 'PR' },
  { ibgeCode: '4126306', name: 'Sengés', state: 'PR' },
  { ibgeCode: '4127106', name: 'Telêmaco Borba', state: 'PR' },
  { ibgeCode: '4127304', name: 'Terra Rica', state: 'PR' },
  { ibgeCode: '4127403', name: 'Terra Roxa', state: 'PR' },
  { ibgeCode: '4127700', name: 'Toledo', state: 'PR' },
  { ibgeCode: '4127965', name: 'Turvo', state: 'PR' },
  { ibgeCode: '4128104', name: 'Umuarama', state: 'PR' },
]
