// Intersection node rendering

import Phaser from 'phaser'
import { Node } from '../data/RoadNetwork'

export class Intersection {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private hitArea?: Phaser.GameObjects.Arc
  public node: Node
  public blocked: boolean = false

  private readonly RADIUS = 16

  constructor(scene: Phaser.Scene, node: Node) {
    this.scene = scene
    this.node = node

    this.graphics = scene.add.graphics()
    this.draw()

    // Only intersections are clickable (for police blockers)
    if (node.type === 'intersection') {
      this.hitArea = scene.add.circle(node.x, node.y, this.RADIUS + 5, 0x000000, 0)
      this.hitArea.setInteractive()

      this.hitArea.on('pointerdown', () => {
        this.toggleBlocked()
      })

      this.hitArea.on('pointerover', () => {
        this.graphics.clear()
        this.draw(true)
      })

      this.hitArea.on('pointerout', () => {
        this.graphics.clear()
        this.draw()
      })
    }
  }

  private draw(hover: boolean = false): void {
    const baseColor = this.node.type === 'depot' ? 0x0066cc :
      this.node.type === 'intersection' ? 0x333333 : 0x555555

    const color = hover ? 0x888888 : baseColor

    this.graphics.fillStyle(color, 1)
    this.graphics.fillCircle(this.node.x, this.node.y, this.RADIUS)

    // Draw blocked indicator
    if (this.blocked) {
      this.graphics.fillStyle(0xff0000, 1)
      this.graphics.fillCircle(this.node.x, this.node.y, this.RADIUS / 2)
    }

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

  toggleBlocked(): void {
    this.blocked = !this.blocked
    this.graphics.clear()
    this.draw()
    this.scene.events.emit('intersectionToggled', this.node, this.blocked)
  }

  destroy(): void {
    this.graphics.destroy()
    if (this.hitArea) this.hitArea.destroy()
  }
}
