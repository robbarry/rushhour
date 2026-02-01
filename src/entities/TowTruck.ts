// Tow truck entity for rescuing stuck cars

import Phaser from 'phaser'
import { Edge, RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'

export interface TowTruckData {
  id: string
  targetCarId: string
  path: Edge[]
  pathIndex: number
  progress: number
  speed: number
  returning: boolean
  currentNodeId: string
  hasCar: boolean
}

export class TowTruck {
  private graphics: Phaser.GameObjects.Graphics
  public data: TowTruckData

  private readonly SIZE = 16

  constructor(scene: Phaser.Scene, data: TowTruckData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(15)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)

    // Truck body - blue
    this.graphics.fillStyle(0x0066cc, 1)
    this.graphics.fillRect(-this.SIZE / 2, -this.SIZE / 3, this.SIZE, this.SIZE * 0.66)

    // Tow hook/bed
    this.graphics.fillStyle(0x444444, 1)
    this.graphics.fillRect(-this.SIZE / 2 - 4, -this.SIZE / 4, 6, this.SIZE / 2)

    // Towed car indicator
    if (this.data.hasCar) {
      this.graphics.fillStyle(0xff6666, 0.8)
      this.graphics.fillRect(-this.SIZE / 2 - 10, -this.SIZE / 4, 8, this.SIZE / 2)
    }

    this.graphics.restore()

    // Flashing light - blue/red alternating
    const flashColor = Math.floor(Date.now() / 250) % 2 === 0 ? 0x0000ff : 0xff0000
    this.graphics.fillStyle(flashColor, 1)
    this.graphics.fillCircle(x, y - 12, 4)
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
