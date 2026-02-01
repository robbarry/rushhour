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
  private scoreText!: Phaser.GameObjects.Text
  private stormText!: Phaser.GameObjects.Text
  private plowStatusText!: Phaser.GameObjects.Text

  // Plow cooldown
  private plowCooldown: number = 0
  private readonly PLOW_COOLDOWN_TIME: number = 2000 // 2 seconds

  // Score tracking
  private score: number = 0

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

    // Create snow particles
    this.createSnowParticles()

    // UI text
    this.add.text(10, 10, 'Rush Hour Snow', {
      fontSize: '24px',
      color: '#ffffff'
    }).setDepth(100)

    this.add.text(10, 40, 'Click road to dispatch plow', {
      fontSize: '14px',
      color: '#aaaaaa'
    }).setDepth(100)

    this.scoreText = this.add.text(10, 70, '', {
      fontSize: '16px',
      color: '#00ff00'
    }).setDepth(100)

    this.stormText = this.add.text(10, 95, '', {
      fontSize: '16px',
      color: '#ffffff'
    }).setDepth(100)

    this.plowStatusText = this.add.text(10, 120, '', {
      fontSize: '16px',
      color: '#ffff00'
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
    // Check cooldown
    if (this.plowCooldown > 0) return

    // Find path from depot to target edge
    // Check both ends of the target edge to see which is closer
    const depotNode = 'depot'
    
    // Path to 'from' node
    const pathA = findPath(this.network, depotNode, targetEdge.from, { ignoreBlocked: true, ignoreSnow: true })
    
    // Path to 'to' node
    const pathB = findPath(this.network, depotNode, targetEdge.to, { ignoreBlocked: true, ignoreSnow: true })

    let pathToTarget: Edge[] | null = null

    if (pathA && pathB) {
      if (pathA.length <= pathB.length) {
        pathToTarget = pathA
      } else {
        pathToTarget = pathB
      }
    } else if (pathA) {
      pathToTarget = pathA
    } else if (pathB) {
      pathToTarget = pathB
    }

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

    // Start cooldown
    this.plowCooldown = this.PLOW_COOLDOWN_TIME
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
    // Find closest end to the car's edge
    const depotNode = 'depot'
    const pathA = findPath(this.network, depotNode, carEdge.from, { ignoreBlocked: true, ignoreSnow: true })
    const pathB = findPath(this.network, depotNode, carEdge.to, { ignoreBlocked: true, ignoreSnow: true })

    let pathToCar: Edge[] | null = null

    if (pathA && pathB) {
      pathToCar = pathA.length <= pathB.length ? pathA : pathB
    } else if (pathA) {
      pathToCar = pathA
    } else if (pathB) {
      pathToCar = pathB
    }

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
    // Update plow cooldown
    if (this.plowCooldown > 0) {
      this.plowCooldown -= delta
    }

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

    // Update HUD
    this.updateHUD()
  }

  private updateHUD(): void {
    // Calculate score: Cars exited (+10), Rescued (+5)
    this.score = this.trafficSystem.stats.exited * 10 + this.trafficSystem.stats.rescued * 5

    // Count clear roads for bonus
    let clearRoads = 0
    for (const edge of this.network.edges.values()) {
      if (edge.id !== 'depot-road' && edge.snow <= 2) {
        clearRoads++
      }
    }

    this.scoreText.setText(
      `Score: ${this.score} | Exited: ${this.trafficSystem.stats.exited} | Rescued: ${this.trafficSystem.stats.rescued} | Stuck: ${this.trafficSystem.stuckCount}`
    )

    // Storm phase indicator with color coding
    const intensity = this.snowSystem.currentIntensity
    let stormColor = '#aaaaaa'
    if (intensity >= 2.0) stormColor = '#ff4444'
    else if (intensity >= 1.5) stormColor = '#ffaa00'
    else if (intensity >= 0.5) stormColor = '#ffffff'
    else stormColor = '#88ff88'

    this.stormText.setStyle({ color: stormColor })
    this.stormText.setText(`Storm: ${this.snowSystem.currentPhaseName}`)

    // Plow status
    if (this.plowCooldown > 0) {
      const remaining = Math.ceil(this.plowCooldown / 1000)
      this.plowStatusText.setText(`Plow: Ready in ${remaining}s`)
      this.plowStatusText.setStyle({ color: '#ff8888' })
    } else {
      this.plowStatusText.setText('Plow: READY')
      this.plowStatusText.setStyle({ color: '#88ff88' })
    }
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
        this.trafficSystem.removeCar(carData.id, 'exited')
        continue
      }

      // Check if stuck in deep snow
      if (currentEdge.snow >= SNOW_LEVELS.DEEP && !carData.stuck) {
        this.trafficSystem.setCarStuck(carData.id, true)
        this.dispatchTowTruck(carData)
      }

      if (carData.stuck) {
        carData.stuckTime += delta
        carData.waiting = false
        // Still update position for rendering
        const pos = this.trafficSystem.getCarPosition(carData)
        const nextPos = this.getNextPosition(carData)
        const angle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x)
        car.draw(pos.x, pos.y, angle)
        continue
      }

      // Check if blocked by car ahead (queueing)
      const blockingCar = this.trafficSystem.isBlockedByCarAhead(carData)
      if (blockingCar) {
        carData.waiting = true
        // Still render at current position
        const pos = this.trafficSystem.getCarPosition(carData)
        const nextPos = this.getNextPosition(carData)
        const angle = Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x)
        car.draw(pos.x, pos.y, angle)
        continue
      }

      carData.waiting = false

      // Try to reroute if current path is bad
      this.trafficSystem.tryReroute(carData)

      // Calculate speed with snow penalty
      const snowPenalty = Math.max(0.2, 1 - currentEdge.snow * 0.08)
      const effectiveSpeed = carData.speed * snowPenalty

      // Move car along edge
      const edgeLength = this.getEdgeLength(currentEdge)
      carData.progress += (effectiveSpeed * deltaSeconds) / edgeLength

      // Check if reached end of current edge
      if (carData.progress >= 1) {
        // Update currentNodeId to the end of this edge BEFORE incrementing pathIndex
        carData.currentNodeId = getOtherNode(currentEdge, carData.currentNodeId)
        carData.progress = 0
        carData.pathIndex++
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

      // Clear snow while moving
      if (currentEdge) {
        this.snowSystem.clearSnow(currentEdge.id, 15 * deltaSeconds)
      }

      // Move plow
      if (currentEdge) {
        const edgeLength = this.getEdgeLength(currentEdge)
        data.progress += (data.speed * deltaSeconds) / edgeLength

        if (data.progress >= 1) {
          // Update currentNodeId to the end of this edge BEFORE incrementing pathIndex
          data.currentNodeId = getOtherNode(currentEdge, data.currentNodeId)
          data.progress = 0
          data.pathIndex++
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
          this.trafficSystem.removeCar(data.targetCarId, 'rescued')

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
          // Update currentNodeId to the end of this edge BEFORE incrementing pathIndex
          data.currentNodeId = getOtherNode(currentEdge, data.currentNodeId)
          data.progress = 0
          data.pathIndex++
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
