// Traffic spawning and routing system

import { RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'
import { findPath } from './PathFinding'
import { Edge } from '../data/RoadNetwork'
import { DIMENSIONS } from '../config/Theme'

export interface CarData {
  id: string
  currentNodeId: string
  destinationNodeId: string
  path: Edge[]
  pathIndex: number
  progress: number // 0-1 along current edge
  speed: number
  stuck: boolean
  stuckTime: number
  waiting: boolean // waiting behind another car
  rerouteCheckTimer: number // frames until next reroute check
}

export class TrafficSystem {
  private network: RoadNetwork
  private cars: Map<string, CarData> = new Map()
  private nextCarId: number = 0
  private spawnTimer: number = 0
  private spawnInterval: number = 3000 // ms between spawns

  // Stats
  public stats = {
    exited: 0,
    rescued: 0,
    stuck: 0
  }

  // Endpoints where cars can spawn/despawn
  private endpoints: string[] = [
    'north', 'south', 'east', 'west'
  ]

  constructor(network: RoadNetwork) {
    this.network = network
  }

  update(delta: number): void {
    this.spawnTimer += delta
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.trySpawnCar()
    }
  }

  private trySpawnCar(): void {
    // Pick random start and end points
    const start = this.endpoints[Math.floor(Math.random() * this.endpoints.length)]
    let end = start
    while (end === start) {
      end = this.endpoints[Math.floor(Math.random() * this.endpoints.length)]
    }

    const path = findPath(this.network, start, end)
    if (!path || path.length === 0) return

    const car: CarData = {
      id: `car-${this.nextCarId++}`,
      currentNodeId: start,
      destinationNodeId: end,
      path,
      pathIndex: 0,
      progress: 0,
      speed: 100 + Math.random() * 50, // pixels per second
      stuck: false,
      stuckTime: 0,
      waiting: false,
      rerouteCheckTimer: 60
    }

    this.cars.set(car.id, car)
  }

  getCars(): CarData[] {
    return Array.from(this.cars.values())
  }

  get stuckCount(): number {
    let count = 0
    for (const car of this.cars.values()) {
      if (car.stuck) count++
    }
    return count
  }

  removeCar(carId: string, reason: 'exited' | 'rescued'): void {
    if (this.cars.has(carId)) {
      this.cars.delete(carId)
      if (reason === 'exited') this.stats.exited++
      if (reason === 'rescued') this.stats.rescued++
    }
  }

  setCarStuck(carId: string, stuck: boolean): void {
    const car = this.cars.get(carId)
    if (car) {
      car.stuck = stuck
      if (!stuck) car.stuckTime = 0
    }
  }

  getCarPosition(car: CarData): { x: number, y: number, angle: number } {
    // Cars drive on the right side of the road (positive lane offset)
    const pos = getPositionOnPath(
      this.network,
      car.path,
      car.pathIndex,
      car.progress,
      car.currentNodeId,
      DIMENSIONS.LANE_OFFSET
    )
    return { x: pos.x, y: pos.y, angle: pos.angle }
  }

  getCurrentEdge(car: CarData): Edge | null {
    if (car.pathIndex >= car.path.length) return null
    return car.path[car.pathIndex]
  }

  // Get cars ahead in the SAME LANE (same direction on same edge)
  getCarsAheadInLane(car: CarData): { car: CarData, distance: number }[] {
    const edge = this.getCurrentEdge(car)
    if (!edge) return []

    const ahead: { car: CarData, distance: number }[] = []

    for (const otherCar of this.cars.values()) {
      if (otherCar.id === car.id) continue

      const otherEdge = this.getCurrentEdge(otherCar)
      if (!otherEdge || otherEdge.id !== edge.id) continue

      // Only check cars going the SAME direction (same lane)
      // Opposite direction cars are in the other lane - they pass by
      if (otherCar.currentNodeId !== car.currentNodeId) continue

      // Check if other car is ahead of us
      if (otherCar.progress > car.progress) {
        ahead.push({
          car: otherCar,
          distance: otherCar.progress - car.progress
        })
      }
    }

    return ahead.sort((a, b) => a.distance - b.distance)
  }

  // Check if there's a car blocking ahead in our lane
  isBlockedByCarAhead(car: CarData, threshold: number = 0.12): CarData | null {
    const ahead = this.getCarsAheadInLane(car)
    if (ahead.length === 0) return null

    const nearest = ahead[0]

    // Stop if close to a stuck or waiting car
    if (nearest.distance < threshold && (nearest.car.stuck || nearest.car.waiting)) {
      return nearest.car
    }

    // Stop if very close to ANY car ahead to prevent overlap
    if (nearest.distance < 0.08) {
      return nearest.car
    }

    return null
  }

  // Try to reroute a car if current path is bad
  tryReroute(car: CarData, snowThreshold: number = 8): boolean {
    car.rerouteCheckTimer--
    if (car.rerouteCheckTimer > 0) return false
    car.rerouteCheckTimer = 60 // Check again in 60 frames (~1 second)

    // Don't reroute if stuck or at start of edge
    if (car.stuck || car.progress > 0.1) return false

    const currentEdge = this.getCurrentEdge(car)
    if (!currentEdge) return false

    // Check if current edge is bad
    const currentEdgeIsBad = currentEdge.snow > snowThreshold || currentEdge.blocked

    if (!currentEdgeIsBad) return false

    // Try to find a better path
    const newPath = findPath(this.network, car.currentNodeId, car.destinationNodeId)
    if (!newPath || newPath.length === 0) return false

    // Calculate remaining path cost
    const remainingPath = car.path.slice(car.pathIndex)
    const oldCost = this.calculatePathCost(remainingPath)
    const newCost = this.calculatePathCost(newPath)

    // Only switch if new path is significantly better (at least 20% better)
    if (newCost < oldCost * 0.8) {
      car.path = newPath
      car.pathIndex = 0
      car.progress = 0
      return true
    }

    return false
  }

  private calculatePathCost(path: Edge[]): number {
    let cost = 0
    for (const edge of path) {
      // Base cost is 1 per edge, plus snow penalty
      cost += 1 + edge.snow * 0.5
      if (edge.blocked) cost += 100 // heavily penalize blocked edges
    }
    return cost
  }
}
