// Road segment rendering

import Phaser from 'phaser'
import { Edge, Node } from '../data/RoadNetwork'
import { SNOW_LEVELS } from '../systems/SnowSystem'

export class Road {
  private graphics: Phaser.GameObjects.Graphics
  private snowOverlay: Phaser.GameObjects.Graphics
  private hitArea: Phaser.GameObjects.Rectangle
  public edge: Edge
  private fromNode: Node
  private toNode: Node

  private readonly ROAD_WIDTH = 24

  constructor(scene: Phaser.Scene, edge: Edge, fromNode: Node, toNode: Node) {
    this.edge = edge
    this.fromNode = fromNode
    this.toNode = toNode

    // Road base
    this.graphics = scene.add.graphics()
    this.drawRoad()

    // Snow overlay
    this.snowOverlay = scene.add.graphics()

    // Hit area for clicking
    const midX = (fromNode.x + toNode.x) / 2
    const midY = (fromNode.y + toNode.y) / 2
    const length = Math.sqrt(
      (toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2
    )

    this.hitArea = scene.add.rectangle(midX, midY, length, this.ROAD_WIDTH + 10, 0x000000, 0)
    this.hitArea.setInteractive()

    // Rotate hit area to match road
    const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x)
    this.hitArea.setRotation(angle)

    this.hitArea.on('pointerdown', () => {
      scene.events.emit('roadClicked', this.edge)
    })

    this.hitArea.on('pointerover', () => {
      this.graphics.clear()
      this.drawRoad(0x666666)
    })

    this.hitArea.on('pointerout', () => {
      this.graphics.clear()
      this.drawRoad()
    })
  }

  private drawRoad(color: number = 0x444444): void {
    this.graphics.lineStyle(this.ROAD_WIDTH, color)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x, this.fromNode.y)
    this.graphics.lineTo(this.toNode.x, this.toNode.y)
    this.graphics.strokePath()

    // Road markings
    this.graphics.lineStyle(2, 0xffff00, 0.5)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x, this.fromNode.y)
    this.graphics.lineTo(this.toNode.x, this.toNode.y)
    this.graphics.strokePath()
  }

  updateSnow(): void {
    this.snowOverlay.clear()

    if (this.edge.snow <= 0) return

    // Calculate opacity based on snow level
    let alpha = 0
    if (this.edge.snow <= SNOW_LEVELS.CLEAR) {
      alpha = this.edge.snow / SNOW_LEVELS.CLEAR * 0.2
    } else if (this.edge.snow <= SNOW_LEVELS.LIGHT) {
      alpha = 0.2 + (this.edge.snow - SNOW_LEVELS.CLEAR) / (SNOW_LEVELS.LIGHT - SNOW_LEVELS.CLEAR) * 0.2
    } else if (this.edge.snow <= SNOW_LEVELS.MODERATE) {
      alpha = 0.4 + (this.edge.snow - SNOW_LEVELS.LIGHT) / (SNOW_LEVELS.MODERATE - SNOW_LEVELS.LIGHT) * 0.2
    } else {
      alpha = 0.6 + Math.min((this.edge.snow - SNOW_LEVELS.MODERATE) / 5, 0.3)
    }

    this.snowOverlay.lineStyle(this.ROAD_WIDTH - 4, 0xffffff, alpha)
    this.snowOverlay.beginPath()
    this.snowOverlay.moveTo(this.fromNode.x, this.fromNode.y)
    this.snowOverlay.lineTo(this.toNode.x, this.toNode.y)
    this.snowOverlay.strokePath()
  }

  destroy(): void {
    this.graphics.destroy()
    this.snowOverlay.destroy()
    this.hitArea.destroy()
  }
}
