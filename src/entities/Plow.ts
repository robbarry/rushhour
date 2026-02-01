// Snow plow entity

import Phaser from 'phaser'
import { Edge, RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'
import { DEPTH, PALETTE, DIMENSIONS, TIMING } from '../config/Theme'

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
  public data: PlowData

  constructor(scene: Phaser.Scene, data: PlowData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.PLOW)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    // Plow body - yellow/orange
    const color = this.data.returning ? PALETTE.PLOW_RETURNING : PALETTE.PLOW_ACTIVE

    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)

    // Truck body
    this.graphics.fillStyle(color, 1)
    this.graphics.fillRect(-DIMENSIONS.PLOW_SIZE / 2, -DIMENSIONS.PLOW_SIZE / 3, DIMENSIONS.PLOW_SIZE, DIMENSIONS.PLOW_SIZE * 0.66)

    // Plow blade (front)
    this.graphics.fillStyle(PALETTE.PLOW_BLADE, 1)
    this.graphics.fillRect(DIMENSIONS.PLOW_SIZE / 2 - 2, -DIMENSIONS.PLOW_SIZE / 2, 4, DIMENSIONS.PLOW_SIZE)

    this.graphics.restore()

    // Flashing light
    if (Math.floor(Date.now() / TIMING.PLOW_FLASH) % 2 === 0) {
      this.graphics.fillStyle(PALETTE.PLOW_FLASH, 1)
      this.graphics.fillCircle(x, y - DIMENSIONS.WARNING_LIGHT_OFFSET, DIMENSIONS.WARNING_LIGHT_RADIUS)
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
  }
}
