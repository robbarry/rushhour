// Traffic spawning and routing system

import { RoadNetwork, Node } from '../data/RoadNetwork'
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

  removeCar(carId: string): void {
    this.cars.delete(carId)
  }

  setCarStuck(carId: string, stuck: boolean): void {
    const car = this.cars.get(carId)
    if (car) {
      car.stuck = stuck
      if (!stuck) car.stuckTime = 0
    }
  }

  getCarPosition(car: CarData): { x: number, y: number } {
    if (car.pathIndex >= car.path.length) {
      const node = this.network.nodes.get(car.destinationNodeId)!
      return { x: node.x, y: node.y }
    }

    const edge = car.path[car.pathIndex]

    // Determine direction along edge
    let startNode: Node
    let endNode: Node

    if (car.pathIndex === 0) {
      startNode = this.network.nodes.get(car.currentNodeId)!
      endNode = this.network.nodes.get(
        edge.from === car.currentNodeId ? edge.to : edge.from
      )!
    } else {
      // Figure out direction based on previous position
      const prevEdge = car.path[car.pathIndex - 1]
      const prevEndNode = edge.from === prevEdge.from || edge.from === prevEdge.to
        ? edge.from : edge.to
      startNode = this.network.nodes.get(prevEndNode)!
      endNode = this.network.nodes.get(
        edge.from === prevEndNode ? edge.to : edge.from
      )!
    }

    return {
      x: startNode.x + (endNode.x - startNode.x) * car.progress,
      y: startNode.y + (endNode.y - startNode.y) * car.progress
    }
  }

  getCurrentEdge(car: CarData): Edge | null {
    if (car.pathIndex >= car.path.length) return null
    return car.path[car.pathIndex]
  }
}
