import {
  PRODUCERS,
  FARMS,
  AREAS,
  SAMPLES,
  ACTIVITIES,
  type Producer,
  type Farm,
  type Area,
  type Sample,
  type Activity,
} from './mock-data'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getProducers(): Promise<Producer[]> {
  await delay(600)
  return PRODUCERS
}

export async function getProducer(id: string): Promise<Producer | undefined> {
  await delay(400)
  return PRODUCERS.find((p) => p.id === id)
}

export async function getFarms(producerId?: string): Promise<Farm[]> {
  await delay(500)
  if (producerId) return FARMS.filter((f) => f.producerId === producerId)
  return FARMS
}

export async function getFarm(id: string): Promise<Farm | undefined> {
  await delay(400)
  return FARMS.find((f) => f.id === id)
}

export async function getAreas(farmId?: string): Promise<Area[]> {
  await delay(500)
  if (farmId) return AREAS.filter((a) => a.farmId === farmId)
  return AREAS
}

export async function getArea(id: string): Promise<Area | undefined> {
  await delay(400)
  return AREAS.find((a) => a.id === id)
}

export async function getSamples(areaId: string): Promise<Sample[]> {
  await delay(600)
  return SAMPLES.filter((s) => s.areaId === areaId)
}

export async function getActivities(): Promise<Activity[]> {
  await delay(700)
  return ACTIVITIES
}

export async function getDashboardStats() {
  await delay(400)
  return {
    totalProducers: PRODUCERS.length,
    totalFarms: FARMS.length,
    totalAreas: AREAS.length,
    activeSeason: 'Safra 25/26',
  }
}
