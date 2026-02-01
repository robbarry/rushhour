// Car entity rendering

import Phaser from 'phaser'
import { CarData } from '../systems/TrafficSystem'

export class Car {
  private graphics: Phaser.GameObjects.Graphics
  public data: CarData

  private readonly SIZE = 12

  constructor(scene: Phaser.Scene, data: CarData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(10)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    // Car body color - red if stuck, otherwise random color based on id
    const hash = this.data.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const hue = (hash * 37) % 360
    const color = this.data.stuck ? 0xff0000 : Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.5).color

    this.graphics.fillStyle(color, 1)

    // Draw rotated rectangle
    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillRect(-this.SIZE / 2, -this.SIZE / 3, this.SIZE, this.SIZE * 0.66)
    this.graphics.restore()

    // Stuck indicator - flashing
    if (this.data.stuck && Math.floor(Date.now() / 300) % 2 === 0) {
      this.graphics.fillStyle(0xffff00, 1)
      this.graphics.fillCircle(x, y - 10, 4)
    }
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
