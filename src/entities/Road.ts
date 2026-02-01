// Road segment rendering

import Phaser from 'phaser'
import { Edge, Node } from '../data/RoadNetwork'
import { SNOW_LEVELS } from '../systems/SnowSystem'
import { DEPTH, PALETTE, DIMENSIONS, SNOW_OVERLAY } from '../config/Theme'

// Snowbank configuration
const SNOWBANK = {
  MIN_SPACING: 12,        // Minimum distance between snowbanks at low snow
  MAX_SPACING: 6,         // Minimum distance at high snow (more frequent)
  MIN_SIZE: 2,            // Radius at low snow
  MAX_SIZE: 5,            // Radius at high snow
  EDGE_OFFSET: 11,        // Distance from road center to snowbank center
  ALPHA_MIN: 0.3,         // Opacity at low snow
  ALPHA_MAX: 0.8,         // Opacity at high snow
} as const

export class Road {
  private graphics: Phaser.GameObjects.Graphics
  private snowOverlay: Phaser.GameObjects.Graphics
  private snowbankGraphics: Phaser.GameObjects.Graphics
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

    // Snowbank graphics (drawn at same depth as snow overlay)
    this.snowbankGraphics = scene.add.graphics()
    this.snowbankGraphics.setDepth(DEPTH.ROAD_SNOW)

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
    // Layer 1: Shoulder (widest, drawn first)
    this.graphics.lineStyle(DIMENSIONS.ROAD_SHOULDER_WIDTH, PALETTE.ROAD_SHOULDER)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x, this.fromNode.y)
    this.graphics.lineTo(this.toNode.x, this.toNode.y)
    this.graphics.strokePath()

    // Layer 2: Asphalt (narrower, on top of shoulder)
    this.graphics.lineStyle(DIMENSIONS.ROAD_WIDTH, color)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x, this.fromNode.y)
    this.graphics.lineTo(this.toNode.x, this.toNode.y)
    this.graphics.strokePath()

    // Layer 3: White edge lines (solid, at ±10px offset from center)
    const angle = Math.atan2(this.toNode.y - this.fromNode.y, this.toNode.x - this.fromNode.x)
    const perpAngle = angle + Math.PI / 2
    const offsetX = Math.cos(perpAngle) * DIMENSIONS.ROAD_EDGE_LINE_OFFSET
    const offsetY = Math.sin(perpAngle) * DIMENSIONS.ROAD_EDGE_LINE_OFFSET

    // Left edge line
    this.graphics.lineStyle(DIMENSIONS.ROAD_EDGE_LINE_WIDTH, PALETTE.ROAD_MARKING_EDGE, 0.7)
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x + offsetX, this.fromNode.y + offsetY)
    this.graphics.lineTo(this.toNode.x + offsetX, this.toNode.y + offsetY)
    this.graphics.strokePath()

    // Right edge line
    this.graphics.beginPath()
    this.graphics.moveTo(this.fromNode.x - offsetX, this.fromNode.y - offsetY)
    this.graphics.lineTo(this.toNode.x - offsetX, this.toNode.y - offsetY)
    this.graphics.strokePath()

    // Layer 4: Dashed center yellow line
    this.drawDashedCenterLine()
  }

  private drawDashedCenterLine(): void {
    // Calculate road direction and length
    const dx = this.toNode.x - this.fromNode.x
    const dy = this.toNode.y - this.fromNode.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    // Dash pattern: 8px dash, 8px gap
    const dashLength = 8
    const gapLength = 8
    const patternLength = dashLength + gapLength

    this.graphics.lineStyle(DIMENSIONS.ROAD_MARKING_WIDTH, PALETTE.ROAD_MARKING_CENTER, 0.6)

    let traveled = 0
    while (traveled < length) {
      const dashEnd = Math.min(traveled + dashLength, length)

      const startX = this.fromNode.x + Math.cos(angle) * traveled
      const startY = this.fromNode.y + Math.sin(angle) * traveled
      const endX = this.fromNode.x + Math.cos(angle) * dashEnd
      const endY = this.fromNode.y + Math.sin(angle) * dashEnd

      this.graphics.beginPath()
      this.graphics.moveTo(startX, startY)
      this.graphics.lineTo(endX, endY)
      this.graphics.strokePath()

      traveled += patternLength
    }
  }

  updateSnow(): void {
    this.snowOverlay.clear()
    this.snowbankGraphics.clear()

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

    // Draw snowbanks along road edges
    this.drawSnowbanks()
  }

  private drawSnowbanks(): void {
    // Calculate snow factor (0 to 1) for scaling snowbank properties
    const snowFactor = Math.min(this.edge.snow / SNOW_LEVELS.DEEP, 1)

    // Interpolate spacing - more snowbanks as snow increases
    const spacing = SNOWBANK.MIN_SPACING - (SNOWBANK.MIN_SPACING - SNOWBANK.MAX_SPACING) * snowFactor

    // Interpolate size - larger snowbanks as snow increases
    const bankSize = SNOWBANK.MIN_SIZE + (SNOWBANK.MAX_SIZE - SNOWBANK.MIN_SIZE) * snowFactor

    // Interpolate alpha
    const bankAlpha = SNOWBANK.ALPHA_MIN + (SNOWBANK.ALPHA_MAX - SNOWBANK.ALPHA_MIN) * snowFactor

    // Calculate road direction
    const dx = this.toNode.x - this.fromNode.x
    const dy = this.toNode.y - this.fromNode.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    // Perpendicular offset for edge placement
    const perpAngle = angle + Math.PI / 2
    const offsetX = Math.cos(perpAngle) * SNOWBANK.EDGE_OFFSET
    const offsetY = Math.sin(perpAngle) * SNOWBANK.EDGE_OFFSET

    // Draw snowbanks along both edges, alternating
    let traveled = spacing / 2 // Start offset from edge
    let leftSide = true

    while (traveled < length - spacing / 2) {
      // Position along road
      const roadX = this.fromNode.x + Math.cos(angle) * traveled
      const roadY = this.fromNode.y + Math.sin(angle) * traveled

      // Position on edge (alternate sides)
      const bankX = roadX + (leftSide ? offsetX : -offsetX)
      const bankY = roadY + (leftSide ? offsetY : -offsetY)

      // Draw semi-circular snowbank shape facing inward
      this.drawSnowbankShape(bankX, bankY, bankSize, angle, leftSide, bankAlpha)

      traveled += spacing
      leftSide = !leftSide
    }
  }

  private drawSnowbankShape(
    x: number,
    y: number,
    size: number,
    roadAngle: number,
    leftSide: boolean,
    alpha: number
  ): void {
    // Draw a semi-circular mound facing toward road center
    // The flat side faces outward, curved side faces inward
    const facingAngle = leftSide ? roadAngle - Math.PI / 2 : roadAngle + Math.PI / 2

    // Use packed snow color for snowbanks (slightly grayer than fresh)
    this.snowbankGraphics.fillStyle(PALETTE.SNOW_PACKED, alpha)

    // Draw semi-circle as a series of points
    this.snowbankGraphics.beginPath()

    // Start angle and end angle for the arc (semi-circle facing inward)
    const startAngle = facingAngle - Math.PI / 2
    const endAngle = facingAngle + Math.PI / 2

    // Move to start of arc
    this.snowbankGraphics.moveTo(
      x + Math.cos(startAngle) * size,
      y + Math.sin(startAngle) * size
    )

    // Draw arc
    const segments = 8
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const a = startAngle + (endAngle - startAngle) * t
      this.snowbankGraphics.lineTo(
        x + Math.cos(a) * size,
        y + Math.sin(a) * size
      )
    }

    this.snowbankGraphics.closePath()
    this.snowbankGraphics.fillPath()
  }

  destroy(): void {
    this.graphics.destroy()
    this.snowOverlay.destroy()
    this.snowbankGraphics.destroy()
    this.hitGraphics.destroy()
  }
}
