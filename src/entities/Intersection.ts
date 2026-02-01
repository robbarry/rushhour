// Intersection node rendering

import Phaser from 'phaser'
import { Node } from '../data/RoadNetwork'
import { PALETTE, DIMENSIONS } from '../config/Theme'

export class Intersection {
  private graphics: Phaser.GameObjects.Graphics
  public node: Node

  constructor(scene: Phaser.Scene, node: Node) {
    this.node = node

    this.graphics = scene.add.graphics()
    this.draw()
  }

  private draw(): void {
    const color = this.node.type === 'depot' ? PALETTE.DEPOT :
      this.node.type === 'intersection' ? PALETTE.INTERSECTION : PALETTE.ENDPOINT

    this.graphics.fillStyle(color, 1)
    this.graphics.fillCircle(this.node.x, this.node.y, DIMENSIONS.INTERSECTION_RADIUS)

    // Draw depot icon
    if (this.node.type === 'depot') {
      this.graphics.fillStyle(PALETTE.DEPOT_ICON, 1)
      this.graphics.fillTriangle(
        this.node.x, this.node.y - 8,
        this.node.x - DIMENSIONS.DEPOT_ICON_SIZE, this.node.y + 6,
        this.node.x + DIMENSIONS.DEPOT_ICON_SIZE, this.node.y + 6
      )
    }
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
