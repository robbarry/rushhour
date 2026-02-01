// Snow accumulation system

import { RoadNetwork } from '../data/RoadNetwork'

export const SNOW_LEVELS = {
  CLEAR: 2,
  LIGHT: 5,
  MODERATE: 8,
  DEEP: 9
}

interface StormPhase {
  duration: number // seconds
  intensity: number // multiplier for base rate
  name: string
}

const STORM_CYCLE: StormPhase[] = [
  { duration: 60, intensity: 0.5, name: 'Light Snow' },
  { duration: 30, intensity: 1.5, name: 'Heavy Snow' },
  { duration: 45, intensity: 0.3, name: 'Lull' },
  { duration: 40, intensity: 2.0, name: 'Blizzard' },
]

export class SnowSystem {
  private baseAccumulationRate: number = 0.3 // units per second
  private network: RoadNetwork

  // Storm phase tracking
  private stormPhaseIndex: number = 0
  private phaseTimer: number = 0
  public currentPhaseName: string = STORM_CYCLE[0].name
  public currentIntensity: number = STORM_CYCLE[0].intensity

  constructor(network: RoadNetwork) {
    this.network = network
  }

  update(delta: number): void {
    const deltaSeconds = delta / 1000

    // Update storm phase
    this.updateStormPhase(deltaSeconds)

    const effectiveRate = this.baseAccumulationRate * this.currentIntensity

    for (const edge of this.network.edges.values()) {
      // Don't accumulate on depot road
      if (edge.id === 'depot-road') continue

      edge.snow += effectiveRate * deltaSeconds
    }
  }

  private updateStormPhase(deltaSeconds: number): void {
    this.phaseTimer += deltaSeconds

    const currentPhase = STORM_CYCLE[this.stormPhaseIndex]
    if (this.phaseTimer >= currentPhase.duration) {
      // Move to next phase
      this.phaseTimer = 0
      this.stormPhaseIndex = (this.stormPhaseIndex + 1) % STORM_CYCLE.length
      const newPhase = STORM_CYCLE[this.stormPhaseIndex]
      this.currentPhaseName = newPhase.name
      this.currentIntensity = newPhase.intensity
    }
  }

  clearSnow(edgeId: string, amount: number): void {
    const edge = this.network.edges.get(edgeId)
    if (edge) {
      edge.snow = Math.max(0, edge.snow - amount)
    }
  }

  getSnowLevel(snow: number): 'clear' | 'light' | 'moderate' | 'deep' {
    if (snow <= SNOW_LEVELS.CLEAR) return 'clear'
    if (snow <= SNOW_LEVELS.LIGHT) return 'light'
    if (snow <= SNOW_LEVELS.MODERATE) return 'moderate'
    return 'deep'
  }

  setAccumulationRate(rate: number): void {
    this.baseAccumulationRate = rate
  }
}
