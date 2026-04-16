/**
 * 몬테카를로 시뮬레이션 엔진
 * claude1.py MonteCarloWorker 포팅
 */
import type { WBSTask, CPMSummary } from '@/lib/types'
import { calculateCPM } from './cpm'

export type Distribution = 'triangular' | 'normal' | 'uniform'

export interface MonteCarloConfig {
  iterations: number       // 100 ~ 10000
  variance: number         // 0.01 ~ 0.50 (ex: 0.20 = ±20%)
  distribution: Distribution
}

export interface MonteCarloResult {
  durations: number[]      // 정렬된 프로젝트 공기 배열
  original: number         // 원래 CPM 총 공기
  mean: number
  median: number
  stdDev: number
  min: number
  max: number
  p10: number
  p50: number
  p80: number
  p90: number
  p95: number
  histogram: { bin: number; count: number }[]
}

// ── 분포별 샘플링 (Python _sample 포팅) ────────────────────

function sampleTriangular(base: number, variance: number): number {
  const lo = base * (1 - variance)
  const hi = base * (1 + variance)
  // triangular distribution with mode = base
  const u = Math.random()
  const f = (base - lo) / (hi - lo)
  if (u < f) {
    return lo + Math.sqrt(u * (hi - lo) * (base - lo))
  } else {
    return hi - Math.sqrt((1 - u) * (hi - lo) * (hi - base))
  }
}

function sampleNormal(base: number, variance: number): number {
  const sigma = (base * variance) / 3
  // Box-Muller transform
  const u1 = Math.random(), u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
  return Math.max(0.1, base + z * sigma)
}

function sampleUniform(base: number, variance: number): number {
  const lo = base * (1 - variance)
  const hi = base * (1 + variance)
  return lo + Math.random() * (hi - lo)
}

function sample(base: number, variance: number, dist: Distribution): number {
  if (base <= 0) return base
  switch (dist) {
    case 'triangular': return sampleTriangular(base, variance)
    case 'normal':     return sampleNormal(base, variance)
    case 'uniform':    return sampleUniform(base, variance)
  }
}

// ── 통계 ────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function buildHistogram(data: number[], bins = 40): { bin: number; count: number }[] {
  if (data.length === 0) return []
  const min = data[0], max = data[data.length - 1]
  const range = max - min || 1
  const binWidth = range / bins
  const hist: { bin: number; count: number }[] = Array.from({ length: bins }, (_, i) => ({
    bin: Math.round(min + i * binWidth),
    count: 0,
  }))
  for (const v of data) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1)
    hist[idx].count++
  }
  return hist
}

// ── 메인 시뮬레이션 ─────────────────────────────────────────

export function runMonteCarlo(
  tasks: WBSTask[],
  config: MonteCarloConfig,
): MonteCarloResult {
  const { iterations, variance, distribution } = config

  // 원본 CPM
  const originalCPM = calculateCPM(tasks)
  const original = originalCPM.totalDuration

  const durations: number[] = []

  for (let iter = 0; iter < iterations; iter++) {
    // 각 태스크 duration을 확률적으로 변동
    const perturbedTasks: WBSTask[] = tasks.map(t => ({
      ...t,
      duration: Math.round(sample(t.duration, variance, distribution) * 10) / 10,
    }))

    const cpm = calculateCPM(perturbedTasks)
    durations.push(Math.round(cpm.totalDuration * 10) / 10)
  }

  durations.sort((a, b) => a - b)

  const n = durations.length
  const mean = durations.reduce((s, v) => s + v, 0) / n
  const median = percentile(durations, 50)
  const variance2 = durations.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const stdDev = Math.sqrt(variance2)

  return {
    durations,
    original,
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    min: durations[0],
    max: durations[n - 1],
    p10: Math.round(percentile(durations, 10) * 10) / 10,
    p50: Math.round(percentile(durations, 50) * 10) / 10,
    p80: Math.round(percentile(durations, 80) * 10) / 10,
    p90: Math.round(percentile(durations, 90) * 10) / 10,
    p95: Math.round(percentile(durations, 95) * 10) / 10,
    histogram: buildHistogram(durations),
  }
}
