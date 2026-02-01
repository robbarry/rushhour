// Road segment rendering

import Phaser from 'phaser'
import { Edge, Node } from '../data/RoadNetwork'
import { SNOW_LEVELS } from '../systems/SnowSystem'

export class Road {
  private graphics: Phaser.GameObjects.Graphics
  private snowOverlay: Phaser.GameObjects.Graphics
  private hitGraphics: Phaser.GameObjects.Graphics
  private hitPolygon: Phaser.Geom.Polygon
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

    // Create polygon hit area that matches actual road shape
    const hitWidth = this.ROAD_WIDTH + 10
    this.hitPolygon = this.calculateRoadPolygon(fromNode, toNode, hitWidth)

    // Invisible graphics for hit detection
    this.hitGraphics = scene.add.graphics()
    this.hitGraphics.fillStyle(0x000000, 0.001) // Nearly invisible
    this.hitGraphics.fillPoints(this.hitPolygon.points, true)
    this.hitGraphics.setInteractive(this.hitPolygon, Phaser.Geom.Polygon.Contains)

    this.hitGraphics.on('pointerdown', () => {
      scene.events.emit('roadClicked', this.edge)
    })

    this.hitGraphics.on('pointerover', () => {
      this.graphics.clear()
      this.drawRoad(0x666666)
    })

    this.hitGraphics.on('pointerout', () => {
      this.graphics.clear()
      this.drawRoad()
    })
  }

  private calculateRoadPolygon(from: Node, to: Node, width: number): Phaser.Geom.Polygon {
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const perpAngle = angle + Math.PI / 2
    const hw = width / 2
    const dx = Math.cos(perpAngle) * hw
    const dy = Math.sin(perpAngle) * hw

    return new Phaser.Geom.Polygon([
      from.x + dx, from.y + dy,
      to.x + dx, to.y + dy,
      to.x - dx, to.y - dy,
      from.x - dx, from.y - dy
    ])
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
    this.hitGraphics.destroy()
  }
}
