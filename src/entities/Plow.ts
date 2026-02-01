// Snow plow entity

import Phaser from 'phaser'
import { Edge, RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'
import { DEPTH, PALETTE, DIMENSIONS } from '../config/Theme'

export interface PlowData {
  id: string
  path: Edge[]
  pathIndex: number
  progress: number
  speed: number
  returning: boolean
  currentNodeId: string
}

export class Plow {
  private graphics: Phaser.GameObjects.Graphics
  private scene: Phaser.Scene
  private sprayEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private lastX: number = 0
  private lastY: number = 0
  private isMoving: boolean = false
  public data: PlowData

  constructor(scene: Phaser.Scene, data: PlowData) {
    this.data = data
    this.scene = scene
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.PLOW)

    // Create snow spray particle emitter
    this.createSprayEmitter()
  }

  private createSprayEmitter(): void {
    // Generate spray particle texture if not already created
    const textureKey = 'plow_spray'
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics()
      // Small white triangle particle
      graphics.fillStyle(PALETTE.SNOW_FRESH, 1)
      graphics.fillTriangle(0, 4, 4, 4, 2, 0)
      graphics.generateTexture(textureKey, 5, 5)
      graphics.destroy()
    }

    // Create particle emitter for snow spray
    this.sprayEmitter = this.scene.add.particles(0, 0, textureKey, {
      lifespan: { min: 200, max: 400 },
      speed: { min: 40, max: 80 },
      angle: { min: -60, max: -30 }, // Angled spray (will be rotated based on plow direction)
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      gravityY: 50,
      frequency: -1, // Manual emission
      emitting: false
    })
    this.sprayEmitter.setDepth(DEPTH.PLOW - 1)
  }

  draw(x: number, y: number, angle: number, snowLevel: number = 0): void {
    this.graphics.clear()

    // Check if plow is moving (position changed from last frame)
    const dx = x - this.lastX
    const dy = y - this.lastY
    this.isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1
    this.lastX = x
    this.lastY = y

    // Update spray effect based on movement and snow level
    this.updateSpray(x, y, angle, snowLevel)

    // Plow body - yellow/orange
    const color = this.data.returning ? PALETTE.PLOW_RETURNING : PALETTE.PLOW_ACTIVE
    const size = DIMENSIONS.PLOW_SIZE
    const halfSize = size / 2
    const bodyHeight = size * 0.66

    // 1. Shadow (drawn first, offset by 2,2)
    this.graphics.save()
    this.graphics.translateCanvas(x + 2, y + 2)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillStyle(0x000000, 0.4)
    // Shadow for truck body
    this.graphics.fillRect(-halfSize, -size / 3, size, bodyHeight)
    // Shadow for blade
    this.graphics.fillRect(halfSize, -halfSize - 2, 5, size + 4)
    this.graphics.restore()

    // 2. Plow blade (curved trapezoid shape at front)
    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)
    // Metallic gray blade - 0x94a3b8
    this.graphics.fillStyle(0x94a3b8, 1)
    // Draw a curved blade using arc
    const bladeX = halfSize
    const bladeWidth = 5
    // Trapezoid blade shape: wider at the cutting edge
    this.graphics.beginPath()
    this.graphics.moveTo(bladeX, -halfSize - 2)
    this.graphics.lineTo(bladeX + bladeWidth + 2, -halfSize - 4)  // Top outer (wider)
    this.graphics.lineTo(bladeX + bladeWidth + 2, halfSize + 4)   // Bottom outer (wider)
    this.graphics.lineTo(bladeX, halfSize + 2)
    this.graphics.closePath()
    this.graphics.fillPath()
    // Add a curved edge highlight
    this.graphics.lineStyle(1.5, 0xb0c4de, 0.8)
    this.graphics.beginPath()
    this.graphics.arc(bladeX + bladeWidth + 2, 0, halfSize + 3, -Math.PI / 2, Math.PI / 2, false)
    this.graphics.strokePath()
    this.graphics.restore()

    // 3. Truck body
    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillStyle(color, 1)
    this.graphics.fillRect(-halfSize, -size / 3, size, bodyHeight)
    this.graphics.restore()

    // 4. Rotating amber beacon on top
    const time = Date.now()
    const beaconRotation = (time / 100) % (Math.PI * 2)  // Full rotation every ~628ms
    const beaconY = y - DIMENSIONS.WARNING_LIGHT_OFFSET
    const beaconRadius = DIMENSIONS.WARNING_LIGHT_RADIUS

    // Beacon base (darker amber)
    this.graphics.fillStyle(0xd97706, 1)
    this.graphics.fillCircle(x, beaconY, beaconRadius)

    // Rotating glow effect - bright spot that sweeps around
    const glowOffsetX = Math.cos(beaconRotation) * (beaconRadius * 0.5)
    const glowOffsetY = Math.sin(beaconRotation) * (beaconRadius * 0.5)
    this.graphics.fillStyle(PALETTE.WARNING_AMBER, 1)
    this.graphics.fillCircle(x + glowOffsetX, beaconY + glowOffsetY, beaconRadius * 0.6)

    // Bright center highlight
    this.graphics.fillStyle(0xfcd34d, 0.9)
    this.graphics.fillCircle(x, beaconY, beaconRadius * 0.3)
  }

  private updateSpray(x: number, y: number, angle: number, snowLevel: number): void {
    if (!this.sprayEmitter) return

    // Only spray when moving AND there's snow to clear
    if (this.isMoving && snowLevel > 0) {
      // Position spray at the blade (front-right of plow)
      const size = DIMENSIONS.PLOW_SIZE
      const bladeOffset = size / 2 + 5

      // Calculate blade position (spray comes off the right side of the blade)
      // The blade is at the front of the plow, spray goes to the side
      const sprayAngle = angle + Math.PI / 2 // 90 degrees to the right of travel direction
      const bladeX = x + Math.cos(angle) * bladeOffset
      const bladeY = y + Math.sin(angle) * bladeOffset

      // Position emitter at blade
      this.sprayEmitter.setPosition(bladeX, bladeY)

      // Set particle emission angle based on plow direction
      // Particles spray off at an angle from the direction of travel
      const angleDeg = Phaser.Math.RadToDeg(sprayAngle)
      this.sprayEmitter.particleAngle = { min: angleDeg - 30, max: angleDeg + 15 }

      // Emit particles based on snow level (more snow = more spray)
      // Snow levels: 0-2 clear, 2-5 light, 5-8 moderate, 9+ deep
      const particleCount = Math.min(Math.ceil(snowLevel / 2), 4)
      this.sprayEmitter.emitParticle(particleCount)
    }
  }

  getPosition(network: RoadNetwork): { x: number, y: number, angle: number } {
    return getPositionOnPath(
      network,
      this.data.path,
      this.data.pathIndex,
      this.data.progress,
      this.data.currentNodeId
    )
  }

  getCurrentEdge(): Edge | null {
    if (this.data.pathIndex >= this.data.path.length) return null
    return this.data.path[this.data.pathIndex]
  }

  destroy(): void {
    this.graphics.destroy()
    if (this.sprayEmitter) {
      this.sprayEmitter.destroy()
      this.sprayEmitter = null
    }
  }
}
