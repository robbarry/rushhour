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
    const baseColor = this.data.stuck ? PALETTE.CAR_STUCK : Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.5).color

    // Darker roof color (reduce brightness by mixing with black)
    const roofColor = this.data.stuck
      ? Phaser.Display.Color.ValueToColor(PALETTE.CAR_STUCK).darken(30).color
      : Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.35).color

    // Car dimensions
    const bodyWidth = 14
    const bodyHeight = 8
    const roofWidth = 8
    const roofHeight = 6
    const cornerRadius = 2
    const shadowOffset = 2

    // Draw shadow first (behind car body)
    this.graphics.save()
    this.graphics.translateCanvas(x + shadowOffset, y + shadowOffset)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillStyle(0x000000, 0.4)
    this.graphics.fillRoundedRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, cornerRadius)
    this.graphics.restore()

    // Draw car body (base layer)
    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)
    this.graphics.fillStyle(baseColor, 1)
    this.graphics.fillRoundedRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, cornerRadius)

    // Draw roof/cabin (smaller darker layer on top)
    this.graphics.fillStyle(roofColor, 1)
    this.graphics.fillRoundedRect(-roofWidth / 2, -roofHeight / 2, roofWidth, roofHeight, cornerRadius)
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
