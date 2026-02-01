// Snow accumulation system

import { RoadNetwork } from '../data/RoadNetwork'

export const SNOW_LEVELS = {
  CLEAR: 2,
  LIGHT: 5,
  MODERATE: 8,
  DEEP: 9
}

export class SnowSystem {
  private accumulationRate: number = 0.3 // units per second
  private network: RoadNetwork

  constructor(network: RoadNetwork) {
    this.network = network
  }

  update(delta: number): void {
    const deltaSeconds = delta / 1000

    for (const edge of this.network.edges.values()) {
      // Don't accumulate on depot road
      if (edge.id === 'depot-road') continue

      edge.snow += this.accumulationRate * deltaSeconds
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
    this.accumulationRate = rate
  }
}
