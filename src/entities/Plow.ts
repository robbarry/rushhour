// Snow plow entity

import Phaser from 'phaser'
import { Edge, RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'

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

  private readonly SIZE = 18

  constructor(scene: Phaser.Scene, data: PlowData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(15)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    // Plow body - yellow/orange
    const color = this.data.returning ? 0xcc8800 : 0xffaa00

    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)

    // Truck body
    this.graphics.fillStyle(color, 1)
    this.graphics.fillRect(-this.SIZE / 2, -this.SIZE / 3, this.SIZE, this.SIZE * 0.66)

    // Plow blade (front)
    this.graphics.fillStyle(0x888888, 1)
    this.graphics.fillRect(this.SIZE / 2 - 2, -this.SIZE / 2, 4, this.SIZE)

    this.graphics.restore()

    // Flashing light
    if (Math.floor(Date.now() / 200) % 2 === 0) {
      this.graphics.fillStyle(0xff8800, 1)
      this.graphics.fillCircle(x, y - 12, 4)
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
