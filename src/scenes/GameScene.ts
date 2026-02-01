// Main game scene

import Phaser from 'phaser'
import { createDefaultNetwork, RoadNetwork, Edge, getOtherNode } from '../data/RoadNetwork'
import { SnowSystem, SNOW_LEVELS } from '../systems/SnowSystem'
import { TrafficSystem, CarData } from '../systems/TrafficSystem'
import { findPath } from '../systems/PathFinding'
import { Road } from '../entities/Road'
import { Intersection } from '../entities/Intersection'
import { Car } from '../entities/Car'
import { Plow, PlowData } from '../entities/Plow'
import { TowTruck, TowTruckData } from '../entities/TowTruck'

export class GameScene extends Phaser.Scene {
  private network!: RoadNetwork
  private snowSystem!: SnowSystem
  private trafficSystem!: TrafficSystem

  private roads: Map<string, Road> = new Map()
  private intersections: Map<string, Intersection> = new Map()
  private cars: Map<string, Car> = new Map()
  private plows: Map<string, Plow> = new Map()
  private towTrucks: Map<string, TowTruck> = new Map()

  private nextPlowId: number = 0
  private nextTowTruckId: number = 0

  private snowParticles!: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    // Initialize systems
    this.network = createDefaultNetwork()
    this.snowSystem = new SnowSystem(this.network)
    this.trafficSystem = new TrafficSystem(this.network)

    // Create road visuals
    for (const edge of this.network.edges.values()) {
      const fromNode = this.network.nodes.get(edge.from)!
      const toNode = this.network.nodes.get(edge.to)!
      const road = new Road(this, edge, fromNode, toNode)
      this.roads.set(edge.id, road)
    }

    // Create intersection visuals
    for (const node of this.network.nodes.values()) {
      const intersection = new Intersection(this, node)
      this.intersections.set(node.id, intersection)
    }

    // Listen for road clicks
    this.events.on('roadClicked', (edge: Edge) => {
      this.dispatchPlow(edge)
    })

    // Listen for intersection toggles
    this.events.on('intersectionToggled', (node: { id: string }, blocked: boolean) => {
      // Mark all edges from this intersection as blocked/unblocked
      const edgeIds = this.network.adjacency.get(node.id) || []
      for (const edgeId of edgeIds) {
        const edge = this.network.edges.get(edgeId)!
        edge.blocked = blocked
      }
    })

    // Create snow particles
    this.createSnowParticles()

    // UI text
    this.add.text(10, 10, 'Rush Hour Snow', {
      fontSize: '24px',
      color: '#ffffff'
    }).setDepth(100)

    this.add.text(10, 40, 'Click road: dispatch plow | Click intersection: toggle blocker', {
      fontSize: '14px',
      color: '#aaaaaa'
    }).setDepth(100)
  }

  private createSnowParticles(): void {
    // Create a simple white particle texture
    const graphics = this.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(4, 4, 4)
    graphics.generateTexture('snowflake', 8, 8)
    graphics.destroy()

    this.snowParticles = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: 800 },
      y: -10,
      lifespan: 8000,
      speedY: { min: 20, max: 40 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.3, end: 0.1 },
      alpha: { start: 0.8, end: 0.2 },
      frequency: 100,
      quantity: 1
    })
    this.snowParticles.setDepth(50)
  }

  private dispatchPlow(targetEdge: Edge): void {
    // Find path from depot to target edge
    const depotNode = 'depot'
    const targetNode = targetEdge.from // Go to one end of the target road

    const pathToTarget = findPath(this.network, depotNode, targetNode, true)
    if (!pathToTarget) return

    // Add the target edge to the path
    const fullPath = [...pathToTarget, targetEdge]

    const plowData: PlowData = {
      id: `plow-${this.nextPlowId++}`,
      path: fullPath,
      pathIndex: 0,
      progress: 0,
      speed: 150,
      returning: false,
      currentNodeId: depotNode
    }

    const plow = new Plow(this, plowData)
    this.plows.set(plowData.id, plow)
  }

  private dispatchTowTruck(stuckCar: CarData): void {
    // Check if a tow truck is already going for this car
    for (const truck of this.towTrucks.values()) {
      if (truck.data.targetCarId === stuckCar.id) return
    }

    // Find the stuck car's current edge and position
    const carEdge = this.trafficSystem.getCurrentEdge(stuckCar)
    if (!carEdge) return

    // Path from depot to the stuck car's location
    const pathToCar = findPath(this.network, 'depot', carEdge.from, true)
    if (!pathToCar) return

    const towData: TowTruckData = {
      id: `tow-${this.nextTowTruckId++}`,
      targetCarId: stuckCar.id,
      path: [...pathToCar, carEdge],
      pathIndex: 0,
      progress: 0,
      speed: 120,
      returning: false,
      currentNodeId: 'depot',
      hasCar: false
    }

    const tow = new TowTruck(this, towData)
    this.towTrucks.set(towData.id, tow)
  }

  update(_time: number, delta: number): void {
    // Update snow
    this.snowSystem.update(delta)

    // Update road snow visuals
    for (const road of this.roads.values()) {
      road.updateSnow()
    }

    // Update traffic system
    this.trafficSystem.update(delta)

    // Update cars
    this.updateCars(delta)

    // Update plows
    this.updatePlows(delta)

    // Update tow trucks
    this.updateTowTrucks(delta)
  }

  private updateCars(delta: number): void {
    const carsData = this.trafficSystem.getCars()
    const deltaSeconds = delta / 1000

    // Sync car entities
    for (const carData of carsData) {
      if (!this.cars.has(carData.id)) {
        this.cars.set(carData.id, new Car(this, carData))
      }
    }

    // Remove cars that no longer exist
    for (const [id, car] of this.cars) {
      if (!carsData.find(c => c.id === id)) {
        car.destroy()
        this.cars.delete(id)
      }
    }

    // Update each car
    for (const carData of carsData) {
      const car = this.cars.get(carData.id)!
      const currentEdge = this.trafficSystem.getCurrentEdge(carData)

      if (!currentEdge) {
        // Car reached destination - remove it
        this.trafficSystem.removeCar(carData.id)
        continue
      }

      // Check if stuck in deep snow
      if (currentEdge.snow >= SNOW_LEVELS.DEEP && !carData.stuck) {
        this.trafficSystem.setCarStuck(carData.id, true)
        this.dispatchTowTruck(carData)
      }

      if (carData.stuck) {
        carData.stuckTime += delta
        // Still update position for rendering
        const pos = this.trafficSystem.getCarPosition(carData)
        const nextPos = this.getNextPosition(carData)
        const angle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x)
        car.draw(pos.x, pos.y, angle)
        continue
      }

      // Calculate speed with snow penalty
      const snowPenalty = Math.max(0.2, 1 - currentEdge.snow * 0.08)
      const effectiveSpeed = carData.speed * snowPenalty

      // Move car along edge
      const edgeLength = this.getEdgeLength(currentEdge)
      carData.progress += (effectiveSpeed * deltaSeconds) / edgeLength

      // Check if reached end of current edge
      if (carData.progress >= 1) {
        carData.progress = 0
        carData.pathIndex++

        if (carData.pathIndex < carData.path.length) {
          // Update current node
          const prevEdge = carData.path[carData.pathIndex - 1]
          carData.currentNodeId = getOtherNode(prevEdge, carData.currentNodeId)
        }
      }

      // Draw car
      const pos = this.trafficSystem.getCarPosition(carData)
      const nextPos = this.getNextPosition(carData)
      const angle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x)
      car.draw(pos.x, pos.y, angle)
    }
  }

  private getNextPosition(carData: CarData): { x: number, y: number } {
    if (carData.pathIndex >= carData.path.length) {
      const node = this.network.nodes.get(carData.destinationNodeId)!
      return { x: node.x, y: node.y }
    }

    const edge = carData.path[carData.pathIndex]
    const toNodeId = edge.from === carData.currentNodeId ? edge.to : edge.from
    const toNode = this.network.nodes.get(toNodeId)!
    return { x: toNode.x, y: toNode.y }
  }

  private updatePlows(delta: number): void {
    const deltaSeconds = delta / 1000
    const toRemove: string[] = []

    for (const [id, plow] of this.plows) {
      const data = plow.data
      const currentEdge = plow.getCurrentEdge()

      if (!currentEdge) {
        if (data.returning) {
          // Returned to depot
          toRemove.push(id)
          continue
        } else {
          // Reached target, start returning
          data.returning = true
          const returnPath = findPath(this.network, data.currentNodeId, 'depot', true)
          if (returnPath) {
            data.path = returnPath
            data.pathIndex = 0
            data.progress = 0
          } else {
            toRemove.push(id)
            continue
          }
        }
      }

      // Clear snow while moving (if not returning)
      if (!data.returning && currentEdge) {
        this.snowSystem.clearSnow(currentEdge.id, 15 * deltaSeconds)
      }

      // Move plow
      if (currentEdge) {
        const edgeLength = this.getEdgeLength(currentEdge)
        data.progress += (data.speed * deltaSeconds) / edgeLength

        if (data.progress >= 1) {
          data.progress = 0
          data.pathIndex++

          if (data.pathIndex < data.path.length) {
            const prevEdge = data.path[data.pathIndex - 1]
            data.currentNodeId = getOtherNode(prevEdge, data.currentNodeId)
          }
        }
      }

      // Draw plow
      const pos = plow.getPosition(this.network)
      plow.draw(pos.x, pos.y, pos.angle)
    }

    // Clean up
    for (const id of toRemove) {
      this.plows.get(id)?.destroy()
      this.plows.delete(id)
    }
  }

  private updateTowTrucks(delta: number): void {
    const deltaSeconds = delta / 1000
    const toRemove: string[] = []

    for (const [id, truck] of this.towTrucks) {
      const data = truck.data
      const currentEdge = truck.getCurrentEdge()

      // Check if target car still exists and is stuck
      const carsData = this.trafficSystem.getCars()
      const targetCar = carsData.find(c => c.id === data.targetCarId)

      if (!data.returning && !data.hasCar) {
        if (!targetCar || !targetCar.stuck) {
          // Target car is gone or unstuck, return to depot
          data.returning = true
          const returnPath = findPath(this.network, data.currentNodeId, 'depot', true)
          if (returnPath) {
            data.path = returnPath
            data.pathIndex = 0
            data.progress = 0
          } else {
            toRemove.push(id)
            continue
          }
        }
      }

      if (!currentEdge) {
        if (data.returning) {
          // Back at depot
          toRemove.push(id)
          continue
        } else if (!data.hasCar && targetCar) {
          // Reached the car, pick it up
          data.hasCar = true
          this.trafficSystem.removeCar(data.targetCarId)

          // Return to depot
          data.returning = true
          const returnPath = findPath(this.network, data.currentNodeId, 'depot', true)
          if (returnPath) {
            data.path = returnPath
            data.pathIndex = 0
            data.progress = 0
          } else {
            toRemove.push(id)
            continue
          }
        }
      }

      // Move truck
      if (currentEdge) {
        const edgeLength = this.getEdgeLength(currentEdge)
        data.progress += (data.speed * deltaSeconds) / edgeLength

        if (data.progress >= 1) {
          data.progress = 0
          data.pathIndex++

          if (data.pathIndex < data.path.length) {
            const prevEdge = data.path[data.pathIndex - 1]
            data.currentNodeId = getOtherNode(prevEdge, data.currentNodeId)
          }
        }
      }

      // Draw truck
      const pos = truck.getPosition(this.network)
      truck.draw(pos.x, pos.y, pos.angle)
    }

    // Clean up
    for (const id of toRemove) {
      this.towTrucks.get(id)?.destroy()
      this.towTrucks.delete(id)
    }
  }

  private getEdgeLength(edge: Edge): number {
    const from = this.network.nodes.get(edge.from)!
    const to = this.network.nodes.get(edge.to)!
    return Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
  }
}
