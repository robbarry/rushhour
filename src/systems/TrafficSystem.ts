// Traffic spawning and routing system

import { RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'
import { findPath } from './PathFinding'
import { Edge } from '../data/RoadNetwork'

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
    'west', 'east',
    'exit-a-north', 'exit-a-south',
    'exit-b-north', 'exit-b-south'
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
      stuckTime: 0
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

  getCarPosition(car: CarData): { x: number, y: number } {
    const pos = getPositionOnPath(
      this.network,
      car.path,
      car.pathIndex,
      car.progress,
      car.currentNodeId
    )
    return { x: pos.x, y: pos.y }
  }

  getCurrentEdge(car: CarData): Edge | null {
    if (car.pathIndex >= car.path.length) return null
    return car.path[car.pathIndex]
  }
}
