// Car entity rendering

import Phaser from 'phaser'
import { CarData } from '../systems/TrafficSystem'
import { DEPTH, PALETTE, DIMENSIONS, TIMING } from '../config/Theme'

export class Car {
  private graphics: Phaser.GameObjects.Graphics
  public data: CarData

  constructor(scene: Phaser.Scene, data: CarData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.CAR)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    // Car body color - red if stuck, otherwise random color based on id
    const hash = this.data.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const hue = (hash * 37) % 360
    const color = this.data.stuck ? PALETTE.CAR_STUCK : Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.5).color

    this.graphics.fillStyle(color, 1)

    // Draw rotated rectangle
    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillRect(-DIMENSIONS.CAR_SIZE / 2, -DIMENSIONS.CAR_SIZE / 3, DIMENSIONS.CAR_SIZE, DIMENSIONS.CAR_SIZE * 0.66)
    this.graphics.restore()

    // Stuck indicator - flashing
    if (this.data.stuck && Math.floor(Date.now() / TIMING.CAR_STUCK_FLASH) % 2 === 0) {
      this.graphics.fillStyle(PALETTE.CAR_STUCK_INDICATOR, 1)
      this.graphics.fillCircle(x, y - DIMENSIONS.WARNING_LIGHT_OFFSET + 2, DIMENSIONS.WARNING_LIGHT_RADIUS)
    }
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
