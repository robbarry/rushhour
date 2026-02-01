// Intersection node rendering

import Phaser from 'phaser'
import { Node } from '../data/RoadNetwork'

export class Intersection {
  private graphics: Phaser.GameObjects.Graphics
  public node: Node

  private readonly RADIUS = 16

  constructor(scene: Phaser.Scene, node: Node) {
    this.node = node

    this.graphics = scene.add.graphics()
    this.draw()
  }

  private draw(): void {
    const color = this.node.type === 'depot' ? 0x0066cc :
      this.node.type === 'intersection' ? 0x333333 : 0x555555

    this.graphics.fillStyle(color, 1)
    this.graphics.fillCircle(this.node.x, this.node.y, this.RADIUS)

    // Draw depot icon
    if (this.node.type === 'depot') {
      this.graphics.fillStyle(0xffff00, 1)
      this.graphics.fillTriangle(
        this.node.x, this.node.y - 8,
        this.node.x - 6, this.node.y + 6,
        this.node.x + 6, this.node.y + 6
      )
    }
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
