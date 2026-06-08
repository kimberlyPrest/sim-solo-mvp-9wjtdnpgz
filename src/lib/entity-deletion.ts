import { supabase } from '@/lib/supabase/client'

type RpcArgs = Record<string, string>

type SupabaseError = {
  code?: string
  message?: string
}

function isRpcUnavailable(error: SupabaseError | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    message.includes('could not find the function') ||
    (message.includes('function') && message.includes('does not exist'))
  )
}

async function callRpcOrFallback(
  functionName: string,
  args: RpcArgs,
  fallback: () => Promise<void>,
) {
  const { error } = await (supabase.rpc as any)(functionName, args)
  if (!error) return
  if (isRpcUnavailable(error)) {
    await fallback()
    return
  }
  throw error
}

async function selectIds(table: string, column: string, value: string) {
  const { data, error } = await (supabase.from as any)(table).select('id').eq(column, value)
  if (error) throw error
  return ((data || []) as { id: string }[]).map((row) => row.id)
}

async function selectIdsIn(table: string, column: string, values: string[]) {
  if (values.length === 0) return []
  const { data, error } = await (supabase.from as any)(table).select('id').in(column, values)
  if (error) throw error
  return ((data || []) as { id: string }[]).map((row) => row.id)
}

async function deleteWhere(table: string, column: string, value: string) {
  const { error } = await (supabase.from as any)(table).delete().eq(column, value)
  if (error) throw error
}

async function deleteIn(table: string, column: string, values: string[]) {
  if (values.length === 0) return
  const { error } = await (supabase.from as any)(table).delete().in(column, values)
  if (error) throw error
}

async function deleteAreaDirect(areaId: string) {
  const [seasonIds, pointIds] = await Promise.all([
    selectIds('area_seasons', 'area_id', areaId),
    selectIds('sampling_points', 'area_id', areaId),
  ])
  const recommendationSetIds = await selectIdsIn('recommendation_sets', 'area_season_id', seasonIds)

  await deleteIn('recommendation_items', 'set_id', recommendationSetIds)
  await deleteIn('recommendation_items', 'sampling_point_id', pointIds)
  await deleteIn('recommendation_sets', 'id', recommendationSetIds)
  await deleteIn('soil_measurements', 'area_season_id', seasonIds)
  await deleteIn('soil_measurements', 'sampling_point_id', pointIds)
  await deleteIn('area_seasons', 'id', seasonIds)
  await deleteIn('sampling_points', 'id', pointIds)
  await deleteWhere('areas', 'id', areaId)
}

async function deleteFarmDirect(farmId: string) {
  const areaIds = await selectIds('areas', 'farm_id', farmId)
  for (const areaId of areaIds) {
    await deleteAreaDirect(areaId)
  }
  await deleteWhere('farms', 'id', farmId)
}

async function deleteProducerDirect(producerId: string) {
  const farmIds = await selectIds('farms', 'producer_id', producerId)
  for (const farmId of farmIds) {
    await deleteFarmDirect(farmId)
  }
  await deleteWhere('producers', 'id', producerId)
}

export async function deleteAreaCascade(areaId: string) {
  await callRpcOrFallback('delete_area_cascade', { p_area_id: areaId }, () =>
    deleteAreaDirect(areaId),
  )
}

export async function deleteFarmCascade(farmId: string) {
  await callRpcOrFallback('delete_farm_cascade', { p_farm_id: farmId }, () =>
    deleteFarmDirect(farmId),
  )
}

export async function deleteProducerCascade(producerId: string) {
  await callRpcOrFallback('delete_producer_cascade', { p_producer_id: producerId }, () =>
    deleteProducerDirect(producerId),
  )
}
