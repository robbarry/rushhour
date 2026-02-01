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
import { DEPTH, PALETTE, DIMENSIONS, TIMING, SPEEDS } from '../config/Theme'

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

  private snowParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  // HUD elements
  private hudPanel!: Phaser.GameObjects.Graphics
  private scoreValueText!: Phaser.GameObjects.Text
  private exitedValueText!: Phaser.GameObjects.Text
  private rescuedValueText!: Phaser.GameObjects.Text
  private stuckValueText!: Phaser.GameObjects.Text
  private stormValueText!: Phaser.GameObjects.Text
  private plowStatusText!: Phaser.GameObjects.Text
  private hudIcons!: Phaser.GameObjects.Graphics

  // Plow cooldown
  private plowCooldown: number = 0

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
      const intersection = new Intersection(this, node, this.network)
      this.intersections.set(node.id, intersection)
    }

    // Listen for road clicks
    this.events.on('roadClicked', (edge: Edge) => {
      this.dispatchPlow(edge)
    })

    // Create snow particles
    this.createSnowParticles()

    // Create ambient effects (vignette and bloom)
    this.createAmbientEffects()

    // Create HUD
    this.createHUD()
  }

  private createAmbientEffects(): void {
    // Create subtle vignette overlay - only darken edges, keep center clear
    const vignetteGraphics = this.add.graphics()
    vignetteGraphics.setDepth(DEPTH.VIGNETTE)

    const centerX = DIMENSIONS.GAME_WIDTH / 2
    const centerY = DIMENSIONS.GAME_HEIGHT / 2
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY)

    // Draw rings from edge inward, only covering the outer 30% of the screen
    const innerClearRadius = maxRadius * 0.7  // Keep center 70% clear
    const steps = 20

    for (let i = 0; i < steps; i++) {
      const ratio = i / steps
      // Start from innerClearRadius and go to maxRadius
      const innerR = innerClearRadius + (maxRadius - innerClearRadius) * ratio
      const outerR = innerClearRadius + (maxRadius - innerClearRadius) * (ratio + 1/steps)

      // Alpha increases toward edge, max 0.3
      const alpha = 0.3 * ratio

      // Draw a ring using lineStyle
      vignetteGraphics.lineStyle(outerR - innerR + 2, 0x000000, alpha)
      vignetteGraphics.strokeCircle(centerX, centerY, (innerR + outerR) / 2)
    }

    // Add bloom post-processing effect on camera for snow glow
    // Phaser 3.60+ supports PostFX pipeline
    if (this.cameras.main.postFX) {
      this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 0.3, 1.1)
    }
  }

  private createHUD(): void {
    const panelX = 10
    const panelY = 10
    const panelWidth = 280
    const panelHeight = 180
    const cornerRadius = 8
    const padding = 16

    // Panel background
    this.hudPanel = this.add.graphics()
    this.hudPanel.setDepth(DEPTH.UI - 1)

    // Draw rounded rectangle background
    this.hudPanel.fillStyle(0x0f172a, 0.85)
    this.hudPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, cornerRadius)

    // Draw border
    this.hudPanel.lineStyle(1, 0x334155, 1)
    this.hudPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, cornerRadius)

    // Icons graphics (will be redrawn in updateHUD)
    this.hudIcons = this.add.graphics()
    this.hudIcons.setDepth(DEPTH.UI)

    // Title
    this.add.text(panelX + padding, panelY + padding, 'TRAFFIC CONTROL', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setDepth(DEPTH.UI)

    // Subtitle
    this.add.text(panelX + padding, panelY + padding + 24, 'CLICK ROAD TO DISPATCH PLOW', {
      fontSize: '10px',
      color: '#64748b'
    }).setDepth(DEPTH.UI)

    // Stats section - labels and values
    const statsY = panelY + padding + 50
    const labelStyle = { fontSize: '10px', color: '#94a3b8' }
    const valueStyle = { fontSize: '16px', fontFamily: 'monospace', color: '#ffffff' }

    // Row 1: Score and Storm
    this.add.text(panelX + padding, statsY, 'SCORE', labelStyle).setDepth(DEPTH.UI)
    this.scoreValueText = this.add.text(panelX + padding + 24, statsY + 12, '0', valueStyle).setDepth(DEPTH.UI)

    this.add.text(panelX + padding + 100, statsY, 'STORM', labelStyle).setDepth(DEPTH.UI)
    this.stormValueText = this.add.text(panelX + padding + 124, statsY + 12, '--', valueStyle).setDepth(DEPTH.UI)

    // Row 2: Exited, Rescued, Stuck
    const row2Y = statsY + 40
    this.add.text(panelX + padding + 24, row2Y, 'EXITED', labelStyle).setDepth(DEPTH.UI)
    this.exitedValueText = this.add.text(panelX + padding + 24, row2Y + 12, '0', valueStyle).setDepth(DEPTH.UI)

    this.add.text(panelX + padding + 100, row2Y, 'RESCUED', labelStyle).setDepth(DEPTH.UI)
    this.rescuedValueText = this.add.text(panelX + padding + 100, row2Y + 12, '0', valueStyle).setDepth(DEPTH.UI)

    this.add.text(panelX + padding + 180, row2Y, 'STUCK', labelStyle).setDepth(DEPTH.UI)
    this.stuckValueText = this.add.text(panelX + padding + 180, row2Y + 12, '0', valueStyle).setDepth(DEPTH.UI)

    // Row 3: Plow status
    const row3Y = statsY + 80
    this.add.text(panelX + padding + 24, row3Y, 'PLOW STATUS', labelStyle).setDepth(DEPTH.UI)
    this.plowStatusText = this.add.text(panelX + padding + 24, row3Y + 12, 'READY', {
      fontSize: '14px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#4ade80'
    }).setDepth(DEPTH.UI)
  }

  private createSnowParticles(): void {
    // Create 3 distinct particle textures for depth/parallax effect
    // Small dot (1px radius) - distant/background layer
    const graphicsSmall = this.add.graphics()
    graphicsSmall.fillStyle(PALETTE.SNOW_FRESH, 0.6)
    graphicsSmall.fillCircle(2, 2, 1)
    graphicsSmall.generateTexture('snowflake_small', 4, 4)
    graphicsSmall.destroy()

    // Medium soft circle (3px radius) - mid layer
    const graphicsMedium = this.add.graphics()
    graphicsMedium.fillStyle(PALETTE.SNOW_FRESH, 0.8)
    graphicsMedium.fillCircle(4, 4, 3)
    graphicsMedium.generateTexture('snowflake_medium', 8, 8)
    graphicsMedium.destroy()

    // Large blurry circle (6px radius) - foreground layer
    const graphicsLarge = this.add.graphics()
    graphicsLarge.fillStyle(PALETTE.SNOW_FRESH, 0.5)
    graphicsLarge.fillCircle(8, 8, 6)
    graphicsLarge.generateTexture('snowflake_large', 16, 16)
    graphicsLarge.destroy()

    // Wind effect constant (positive = blowing right)
    const windStrength = 10

    // Background layer - small, slow, subtle parallax
    const emitterSmall = this.add.particles(0, 0, 'snowflake_small', {
      x: { min: -50, max: DIMENSIONS.GAME_WIDTH + 50 },
      y: -10,
      lifespan: { min: 10000, max: 14000 },
      speedY: { min: 15, max: 25 },
      speedX: { min: -5, max: 5 },
      gravityX: windStrength * 0.5,
      scale: { start: 0.8, end: 0.4 },
      alpha: { start: 0.4, end: 0.1 },
      frequency: 80,
      quantity: 2
    })
    emitterSmall.setDepth(DEPTH.PARTICLES - 2)
    emitterSmall.setScrollFactor(0.3)
    this.snowParticles.push(emitterSmall)

    // Mid layer - medium size, moderate speed
    const emitterMedium = this.add.particles(0, 0, 'snowflake_medium', {
      x: { min: -30, max: DIMENSIONS.GAME_WIDTH + 30 },
      y: -10,
      lifespan: { min: 7000, max: 10000 },
      speedY: { min: 30, max: 50 },
      speedX: { min: -8, max: 8 },
      gravityX: windStrength,
      scale: { start: 0.6, end: 0.3 },
      alpha: { start: 0.6, end: 0.2 },
      frequency: 120,
      quantity: 1
    })
    emitterMedium.setDepth(DEPTH.PARTICLES)
    emitterMedium.setScrollFactor(0.6)
    this.snowParticles.push(emitterMedium)

    // Foreground layer - large, fast, prominent
    const emitterLarge = this.add.particles(0, 0, 'snowflake_large', {
      x: { min: -20, max: DIMENSIONS.GAME_WIDTH + 20 },
      y: -20,
      lifespan: { min: 4000, max: 6000 },
      speedY: { min: 50, max: 80 },
      speedX: { min: -15, max: 15 },
      gravityX: windStrength * 1.5,
      scale: { start: 0.5, end: 0.2 },
      alpha: { start: 0.7, end: 0.1 },
      frequency: 200,
      quantity: 1
    })
    emitterLarge.setDepth(DEPTH.PARTICLES + 2)
    emitterLarge.setScrollFactor(1.0)
    this.snowParticles.push(emitterLarge)
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
      speed: SPEEDS.PLOW,
      returning: false,
      currentNodeId: depotNode
    }

    const plow = new Plow(this, plowData)
    this.plows.set(plowData.id, plow)

    // Start cooldown
    this.plowCooldown = TIMING.PLOW_COOLDOWN
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
      speed: SPEEDS.TOW_TRUCK,
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

    // Update score value
    this.scoreValueText.setText(this.score.toString().padStart(4, '0'))

    // Update stats
    this.exitedValueText.setText(this.trafficSystem.stats.exited.toString())
    this.rescuedValueText.setText(this.trafficSystem.stats.rescued.toString())
    this.stuckValueText.setText(this.trafficSystem.stuckCount.toString())

    // Storm phase indicator with color coding
    const intensity = this.snowSystem.currentIntensity
    let stormColor = '#94a3b8'
    if (intensity >= 2.0) stormColor = '#f87171'
    else if (intensity >= 1.5) stormColor = '#fbbf24'
    else if (intensity >= 0.5) stormColor = '#ffffff'
    else stormColor = '#4ade80'

    this.stormValueText.setStyle({ color: stormColor })
    this.stormValueText.setText(this.snowSystem.currentPhaseName.toUpperCase())

    // Plow status
    if (this.plowCooldown > 0) {
      const remaining = Math.ceil(this.plowCooldown / 1000)
      this.plowStatusText.setText(`READY IN ${remaining}s`)
      this.plowStatusText.setStyle({ color: '#f87171' })
    } else {
      this.plowStatusText.setText('READY')
      this.plowStatusText.setStyle({ color: '#4ade80' })
    }

    // Draw icons
    this.drawHUDIcons()
  }

  private drawHUDIcons(): void {
    const panelX = 10
    const panelY = 10
    const padding = 16
    const statsY = panelY + padding + 50
    const row2Y = statsY + 40
    const row3Y = statsY + 80

    this.hudIcons.clear()

    // Score icon - star shape
    this.hudIcons.fillStyle(0xfbbf24, 1) // amber
    this.drawStar(panelX + padding + 8, statsY + 18, 6, 5)

    // Storm icon - cloud
    this.hudIcons.fillStyle(0x64748b, 1)
    this.drawCloud(panelX + padding + 108, statsY + 18, 8)

    // Exited icon - arrow pointing right (car leaving)
    this.hudIcons.fillStyle(0x4ade80, 1) // green
    this.drawArrowRight(panelX + padding + 8, row2Y + 18, 8)

    // Rescued icon - cross/plus (rescue)
    this.hudIcons.fillStyle(0x60a5fa, 1) // blue
    this.drawCross(panelX + padding + 84, row2Y + 18, 6)

    // Stuck icon - warning triangle
    this.hudIcons.fillStyle(0xf87171, 1) // red
    this.drawTriangle(panelX + padding + 164, row2Y + 18, 7)

    // Plow icon - triangle/plow blade
    this.hudIcons.fillStyle(0xfbbf24, 1) // amber
    this.drawPlowIcon(panelX + padding + 8, row3Y + 18, 8)
  }

  private drawStar(cx: number, cy: number, radius: number, points: number): void {
    const innerRadius = radius * 0.4
    const angle = Math.PI / points

    this.hudIcons.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : innerRadius
      const a = i * angle - Math.PI / 2
      const x = cx + r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      if (i === 0) {
        this.hudIcons.moveTo(x, y)
      } else {
        this.hudIcons.lineTo(x, y)
      }
    }
    this.hudIcons.closePath()
    this.hudIcons.fillPath()
  }

  private drawCloud(cx: number, cy: number, size: number): void {
    // Simple cloud shape using circles
    this.hudIcons.fillCircle(cx - size * 0.3, cy, size * 0.4)
    this.hudIcons.fillCircle(cx + size * 0.3, cy, size * 0.4)
    this.hudIcons.fillCircle(cx, cy - size * 0.2, size * 0.5)
    this.hudIcons.fillCircle(cx, cy + size * 0.1, size * 0.35)
  }

  private drawArrowRight(cx: number, cy: number, size: number): void {
    this.hudIcons.beginPath()
    this.hudIcons.moveTo(cx - size * 0.5, cy - size * 0.3)
    this.hudIcons.lineTo(cx + size * 0.2, cy - size * 0.3)
    this.hudIcons.lineTo(cx + size * 0.2, cy - size * 0.5)
    this.hudIcons.lineTo(cx + size * 0.5, cy)
    this.hudIcons.lineTo(cx + size * 0.2, cy + size * 0.5)
    this.hudIcons.lineTo(cx + size * 0.2, cy + size * 0.3)
    this.hudIcons.lineTo(cx - size * 0.5, cy + size * 0.3)
    this.hudIcons.closePath()
    this.hudIcons.fillPath()
  }

  private drawCross(cx: number, cy: number, size: number): void {
    const thickness = size * 0.35
    // Horizontal bar
    this.hudIcons.fillRect(cx - size * 0.5, cy - thickness * 0.5, size, thickness)
    // Vertical bar
    this.hudIcons.fillRect(cx - thickness * 0.5, cy - size * 0.5, thickness, size)
  }

  private drawTriangle(cx: number, cy: number, size: number): void {
    this.hudIcons.beginPath()
    this.hudIcons.moveTo(cx, cy - size * 0.6)
    this.hudIcons.lineTo(cx + size * 0.5, cy + size * 0.4)
    this.hudIcons.lineTo(cx - size * 0.5, cy + size * 0.4)
    this.hudIcons.closePath()
    this.hudIcons.fillPath()
  }

  private drawPlowIcon(cx: number, cy: number, size: number): void {
    // Plow blade shape - angled blade
    this.hudIcons.beginPath()
    this.hudIcons.moveTo(cx - size * 0.5, cy + size * 0.3)
    this.hudIcons.lineTo(cx + size * 0.5, cy - size * 0.3)
    this.hudIcons.lineTo(cx + size * 0.5, cy + size * 0.1)
    this.hudIcons.lineTo(cx - size * 0.3, cy + size * 0.5)
    this.hudIcons.closePath()
    this.hudIcons.fillPath()
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
        car.draw(pos.x, pos.y, pos.angle)
        continue
      }

      // Check if blocked by car ahead (queueing)
      const blockingCar = this.trafficSystem.isBlockedByCarAhead(carData)
      if (blockingCar) {
        carData.waiting = true
        // Still render at current position
        const pos = this.trafficSystem.getCarPosition(carData)
        car.draw(pos.x, pos.y, pos.angle)
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

      // Draw car using angle from position calculation
      const pos = this.trafficSystem.getCarPosition(carData)
      car.draw(pos.x, pos.y, pos.angle)
    }
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

      // Check if blocked by a stuck car on this edge
      let blockedByStuckCar = false
      if (currentEdge) {
        const carsData = this.trafficSystem.getCars()
        for (const car of carsData) {
          if (!car.stuck) continue
          const carEdge = this.trafficSystem.getCurrentEdge(car)
          if (!carEdge || carEdge.id !== currentEdge.id) continue

          // Calculate car's position from plow's perspective
          let carPosOnEdge: number
          if (car.currentNodeId === data.currentNodeId) {
            carPosOnEdge = car.progress
          } else {
            carPosOnEdge = 1 - car.progress
          }

          // If stuck car is ahead of plow, block
          if (carPosOnEdge > data.progress && carPosOnEdge - data.progress < 0.3) {
            blockedByStuckCar = true
            break
          }
        }
      }

      // Clear snow while moving (only if not blocked)
      if (currentEdge && !blockedByStuckCar) {
        this.snowSystem.clearSnow(currentEdge.id, 15 * deltaSeconds)
      }

      // Move plow (only if not blocked)
      if (currentEdge && !blockedByStuckCar) {
        const edgeLength = this.getEdgeLength(currentEdge)
        data.progress += (data.speed * deltaSeconds) / edgeLength

        if (data.progress >= 1) {
          // Update currentNodeId to the end of this edge BEFORE incrementing pathIndex
          data.currentNodeId = getOtherNode(currentEdge, data.currentNodeId)
          data.progress = 0
          data.pathIndex++
        }
      }

      // Draw plow with snow level for spray effect
      const pos = plow.getPosition(this.network)
      const snowLevel = currentEdge ? currentEdge.snow : 0
      plow.draw(pos.x, pos.y, pos.angle, snowLevel)
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
