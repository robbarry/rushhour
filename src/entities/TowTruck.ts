// Tow truck entity for rescuing stuck cars

import Phaser from 'phaser'
import { Edge, RoadNetwork, getPositionOnPath } from '../data/RoadNetwork'
import { DEPTH, PALETTE, DIMENSIONS, TIMING } from '../config/Theme'

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

  constructor(scene: Phaser.Scene, data: TowTruckData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.TOW_TRUCK)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)

    // Truck body - blue
    this.graphics.fillStyle(PALETTE.TOW_TRUCK, 1)
    this.graphics.fillRect(-DIMENSIONS.TOW_TRUCK_SIZE / 2, -DIMENSIONS.TOW_TRUCK_SIZE / 3, DIMENSIONS.TOW_TRUCK_SIZE, DIMENSIONS.TOW_TRUCK_SIZE * 0.66)

    // Tow hook/bed
    this.graphics.fillStyle(PALETTE.TOW_BED, 1)
    this.graphics.fillRect(-DIMENSIONS.TOW_TRUCK_SIZE / 2 - 4, -DIMENSIONS.TOW_TRUCK_SIZE / 4, 6, DIMENSIONS.TOW_TRUCK_SIZE / 2)

    // Towed car indicator
    if (this.data.hasCar) {
      this.graphics.fillStyle(PALETTE.TOW_TOWED_CAR, 0.8)
      this.graphics.fillRect(-DIMENSIONS.TOW_TRUCK_SIZE / 2 - 10, -DIMENSIONS.TOW_TRUCK_SIZE / 4, 8, DIMENSIONS.TOW_TRUCK_SIZE / 2)
    }

    this.graphics.restore()

    // Flashing light - blue/red alternating
    const flashColor = Math.floor(Date.now() / TIMING.TOW_FLASH) % 2 === 0 ? PALETTE.TOW_FLASH_BLUE : PALETTE.TOW_FLASH_RED
    this.graphics.fillStyle(flashColor, 1)
    this.graphics.fillCircle(x, y - DIMENSIONS.WARNING_LIGHT_OFFSET, DIMENSIONS.WARNING_LIGHT_RADIUS)
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
