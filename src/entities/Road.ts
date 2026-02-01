// Road segment rendering

import Phaser from 'phaser'
import { Edge, Node } from '../data/RoadNetwork'
import { SNOW_LEVELS } from '../systems/SnowSystem'
import { DEPTH, PALETTE, DIMENSIONS, SNOW_OVERLAY } from '../config/Theme'

export class Road {
  private graphics: Phaser.GameObjects.Graphics
  private snowOverlay: Phaser.GameObjects.Graphics
  private hitGraphics: Phaser.GameObjects.Graphics
  private hitPolygon: Phaser.Geom.Polygon
  public edge: Edge
  private fromNode: Node
  private toNode: Node

  constructor(scene: Phaser.Scene, edge: Edge, fromNode: Node, toNode: Node) {
    this.edge = edge
    this.fromNode = fromNode
    this.toNode = toNode

    // Road base
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.ROAD)
    this.drawRoad()

    // Snow overlay
    this.snowOverlay = scene.add.graphics()
    this.snowOverlay.setDepth(DEPTH.ROAD_SNOW)

    // Create polygon hit area that matches actual road shape
    const hitWidth = DIMENSIONS.ROAD_WIDTH + DIMENSIONS.ROAD_HIT_PADDING
    this.hitPolygon = this.calculateRoadPolygon(fromNode, toNode, hitWidth)

    // Invisible graphics for hit detection
    this.hitGraphics = scene.add.graphics()
    this.hitGraphics.setDepth(DEPTH.ROAD_SNOW) // Above road for click detection
    this.hitGraphics.fillStyle(0x000000, 0.001) // Nearly invisible
    this.hitGraphics.fillPoints(this.hitPolygon.points, true)
    this.hitGraphics.setInteractive(this.hitPolygon, Phaser.Geom.Polygon.Contains)

    this.hitGraphics.on('pointerdown', () => {
      scene.events.emit('roadClicked', this.edge)
    })

    this.hitGraphics.on('pointerover', () => {
      this.graphics.clear()
      this.drawRoad(PALETTE.ROAD_ASPHALT_HOVER)
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

  private drawRoad(color: number = PALETTE.ROAD_ASPHALT): void {
    this.graphics.lineStyle(DIMENSIONS.ROAD_WIDTH, color)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x, this.fromNode.y)
    this.graphics.lineTo(this.toNode.x, this.toNode.y)
    this.graphics.strokePath()

    // Road markings
    this.graphics.lineStyle(DIMENSIONS.ROAD_MARKING_WIDTH, PALETTE.ROAD_MARKING_CENTER, 0.5)
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
      alpha = this.edge.snow / SNOW_LEVELS.CLEAR * SNOW_OVERLAY.ALPHA_CLEAR_MAX
    } else if (this.edge.snow <= SNOW_LEVELS.LIGHT) {
      alpha = SNOW_OVERLAY.ALPHA_CLEAR_MAX + (this.edge.snow - SNOW_LEVELS.CLEAR) / (SNOW_LEVELS.LIGHT - SNOW_LEVELS.CLEAR) * (SNOW_OVERLAY.ALPHA_LIGHT_MAX - SNOW_OVERLAY.ALPHA_CLEAR_MAX)
    } else if (this.edge.snow <= SNOW_LEVELS.MODERATE) {
      alpha = SNOW_OVERLAY.ALPHA_LIGHT_MAX + (this.edge.snow - SNOW_LEVELS.LIGHT) / (SNOW_LEVELS.MODERATE - SNOW_LEVELS.LIGHT) * (SNOW_OVERLAY.ALPHA_MODERATE_MAX - SNOW_OVERLAY.ALPHA_LIGHT_MAX)
    } else {
      alpha = SNOW_OVERLAY.ALPHA_MODERATE_MAX + Math.min((this.edge.snow - SNOW_LEVELS.MODERATE) / 5, SNOW_OVERLAY.ALPHA_DEEP_MAX - SNOW_OVERLAY.ALPHA_MODERATE_MAX)
    }

    this.snowOverlay.lineStyle(DIMENSIONS.ROAD_WIDTH - SNOW_OVERLAY.ROAD_INNER_REDUCTION, PALETTE.SNOW_FRESH, alpha)
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
