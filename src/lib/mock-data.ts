export type Producer = {
  id: string
  name: string
  document: string
  totalFarms: number
  status: 'Ativo' | 'Inativo'
}

export type Farm = {
  id: string
  producerId: string
  name: string
  city: string
  state: string
  totalArea: number
}

export type Area = {
  id: string
  farmId: string
  name: string
  size: number
  crop: string
  lastSampleDate: string
}

export type Sample = {
  id: string
  areaId: string
  depth: string
  ph: number
  p: number
  k: number
  ca: number
  mg: number
  mo: number
}

export type Activity = {
  id: string
  action: string
  user: string
  date: string
  target: string
}

export const PRODUCERS: Producer[] = [
  {
    id: '1',
    name: 'João Batista Silva',
    document: '123.456.789-00',
    totalFarms: 2,
    status: 'Ativo',
  },
  {
    id: '2',
    name: 'Agropecuária Boa Vista',
    document: '12.345.678/0001-90',
    totalFarms: 5,
    status: 'Ativo',
  },
  {
    id: '3',
    name: 'Mário Fernandes',
    document: '987.654.321-11',
    totalFarms: 1,
    status: 'Inativo',
  },
]

export const FARMS: Farm[] = [
  {
    id: 'f1',
    producerId: '1',
    name: 'Fazenda Santa Cruz',
    city: 'Rio Verde',
    state: 'GO',
    totalArea: 1500,
  },
  {
    id: 'f2',
    producerId: '1',
    name: 'Sítio Pôr do Sol',
    city: 'Jataí',
    state: 'GO',
    totalArea: 350,
  },
  {
    id: 'f3',
    producerId: '2',
    name: 'Fazenda Alvorada',
    city: 'Sorriso',
    state: 'MT',
    totalArea: 5000,
  },
]

export const AREAS: Area[] = [
  {
    id: 'a1',
    farmId: 'f1',
    name: 'Talhão 01',
    size: 120,
    crop: 'Soja 25/26',
    lastSampleDate: '2025-08-15',
  },
  {
    id: 'a2',
    farmId: 'f1',
    name: 'Talhão 02',
    size: 85,
    crop: 'Milho Safrinha',
    lastSampleDate: '2025-08-16',
  },
  {
    id: 'a3',
    farmId: 'f3',
    name: 'Pivô Central',
    size: 150,
    crop: 'Algodão',
    lastSampleDate: '2025-09-01',
  },
]

export const SAMPLES: Sample[] = [
  { id: 's1', areaId: 'a1', depth: '0-20cm', ph: 5.8, p: 12.5, k: 85, ca: 3.2, mg: 1.1, mo: 2.5 },
  { id: 's2', areaId: 'a1', depth: '20-40cm', ph: 5.2, p: 4.1, k: 45, ca: 1.8, mg: 0.7, mo: 1.2 },
  { id: 's3', areaId: 'a2', depth: '0-20cm', ph: 6.1, p: 18.2, k: 110, ca: 4.0, mg: 1.5, mo: 3.1 },
]

export const ACTIVITIES: Activity[] = [
  {
    id: 'act1',
    action: 'Importação de Análises',
    user: 'Ana Paula (Técnica)',
    date: 'Hoje, 09:30',
    target: 'Fazenda Santa Cruz',
  },
  {
    id: 'act2',
    action: 'Atualização de Recomendação',
    user: 'Carlos Mendes (Agrônomo)',
    date: 'Ontem, 16:45',
    target: 'Talhão 01 - Soja',
  },
  {
    id: 'act3',
    action: 'Cadastro de Área',
    user: 'Sistema',
    date: '15 Mai 2025',
    target: 'Pivô Central',
  },
]
