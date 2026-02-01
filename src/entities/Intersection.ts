// Intersection node rendering

import Phaser from 'phaser'
import { Node, RoadNetwork } from '../data/RoadNetwork'
import { DEPTH, PALETTE, DIMENSIONS } from '../config/Theme'

export class Intersection {
  private graphics: Phaser.GameObjects.Graphics
  public node: Node
  private network: RoadNetwork | null

  constructor(scene: Phaser.Scene, node: Node, network?: RoadNetwork) {
    this.node = node
    this.network = network || null

    this.graphics = scene.add.graphics()
    this.graphics.setDepth(DEPTH.INTERSECTION)
    this.draw()
  }

  private draw(): void {
    // Use road asphalt color for regular intersections for seamless blending
    const color = this.node.type === 'depot' ? PALETTE.DEPOT :
      PALETTE.ROAD_ASPHALT

    this.graphics.fillStyle(color, 1)
    this.graphics.fillCircle(this.node.x, this.node.y, DIMENSIONS.INTERSECTION_RADIUS)

    // Draw crosswalk stripes for intersections
    if (this.node.type === 'intersection' && this.network) {
      this.drawCrosswalks()
    }

    // Draw depot with distinct visual
    if (this.node.type === 'depot') {
      this.drawDepot()
    }
  }

  private drawCrosswalks(): void {
    if (!this.network) return

    const edgeIds = this.network.adjacency.get(this.node.id) || []
    const radius = DIMENSIONS.INTERSECTION_RADIUS

    for (const edgeId of edgeIds) {
      const edge = this.network.edges.get(edgeId)
      if (!edge) continue

      // Find the other node to determine direction
      const otherNodeId = edge.from === this.node.id ? edge.to : edge.from
      const otherNode = this.network.nodes.get(otherNodeId)
      if (!otherNode) continue

      // Calculate angle to connected node
      const dx = otherNode.x - this.node.x
      const dy = otherNode.y - this.node.y
      const angle = Math.atan2(dy, dx)

      // Draw 4 crosswalk stripes perpendicular to the road direction
      // Position them at the edge of the intersection
      const stripeCount = 4
      const stripeWidth = 2
      const stripeLength = 8
      const stripeSpacing = 4
      const distFromCenter = radius - 4 // Position near edge of intersection

      // Perpendicular angle for stripes
      const perpAngle = angle + Math.PI / 2

      // Base position at edge of intersection toward connected road
      const baseX = this.node.x + Math.cos(angle) * distFromCenter
      const baseY = this.node.y + Math.sin(angle) * distFromCenter

      this.graphics.fillStyle(PALETTE.ROAD_MARKING_EDGE, 0.8)

      for (let i = 0; i < stripeCount; i++) {
        // Offset along perpendicular direction from center of crosswalk
        const offset = (i - (stripeCount - 1) / 2) * stripeSpacing
        const stripeX = baseX + Math.cos(perpAngle) * offset
        const stripeY = baseY + Math.sin(perpAngle) * offset

        // Draw stripe as a small rectangle rotated perpendicular to road
        this.drawRotatedRect(
          stripeX,
          stripeY,
          stripeWidth,
          stripeLength,
          angle
        )
      }
    }
  }

  private drawRotatedRect(cx: number, cy: number, width: number, height: number, angle: number): void {
    // Draw a rectangle centered at (cx, cy) rotated by angle
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const hw = width / 2
    const hh = height / 2

    // Calculate corners
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ].map(c => ({
      x: cx + c.x * cos - c.y * sin,
      y: cy + c.x * sin + c.y * cos
    }))

    this.graphics.beginPath()
    this.graphics.moveTo(corners[0].x, corners[0].y)
    this.graphics.lineTo(corners[1].x, corners[1].y)
    this.graphics.lineTo(corners[2].x, corners[2].y)
    this.graphics.lineTo(corners[3].x, corners[3].y)
    this.graphics.closePath()
    this.graphics.fillPath()
  }

  private drawDepot(): void {
    const x = this.node.x
    const y = this.node.y
    const radius = DIMENSIONS.INTERSECTION_RADIUS

    // Draw outer glow ring
    this.graphics.lineStyle(3, PALETTE.DEPOT_GLOW, 0.4)
    this.graphics.strokeCircle(x, y, radius + 4)

    // Draw inner accent ring
    this.graphics.lineStyle(2, PALETTE.DEPOT_GLOW, 0.8)
    this.graphics.strokeCircle(x, y, radius - 2)

    // Draw building icon - small house/garage shape
    const iconSize = 10
    this.graphics.fillStyle(PALETTE.DEPOT_ICON, 1)

    // Roof (triangle)
    this.graphics.fillTriangle(
      x, y - iconSize,
      x - iconSize, y - 2,
      x + iconSize, y - 2
    )

    // Building body (rectangle)
    this.graphics.fillStyle(PALETTE.SNOW_PACKED, 1)
    this.graphics.fillRect(x - iconSize + 2, y - 2, iconSize * 2 - 4, iconSize)

    // Garage door (darker rectangle)
    this.graphics.fillStyle(PALETTE.ROAD_ASPHALT, 1)
    this.graphics.fillRect(x - 4, y + 1, 8, 7)
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
