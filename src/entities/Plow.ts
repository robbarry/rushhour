// Snow plow entity

import Phaser from 'phaser'
import { Edge, RoadNetwork, getOtherNode } from '../data/RoadNetwork'

export interface PlowData {
  id: string
  path: Edge[]
  pathIndex: number
  progress: number
  speed: number
  returning: boolean
  currentNodeId: string
}

export class Plow {
  private graphics: Phaser.GameObjects.Graphics
  public data: PlowData

  private readonly SIZE = 18

  constructor(scene: Phaser.Scene, data: PlowData) {
    this.data = data
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(15)
  }

  draw(x: number, y: number, angle: number): void {
    this.graphics.clear()

    // Plow body - yellow/orange
    const color = this.data.returning ? 0xcc8800 : 0xffaa00

    this.graphics.save()
    this.graphics.translateCanvas(x, y)
    this.graphics.rotateCanvas(angle)

    // Truck body
    this.graphics.fillStyle(color, 1)
    this.graphics.fillRect(-this.SIZE / 2, -this.SIZE / 3, this.SIZE, this.SIZE * 0.66)

    // Plow blade (front)
    if (!this.data.returning) {
      this.graphics.fillStyle(0x888888, 1)
      this.graphics.fillRect(this.SIZE / 2 - 2, -this.SIZE / 2, 4, this.SIZE)
    }

    this.graphics.restore()

    // Flashing light
    if (Math.floor(Date.now() / 200) % 2 === 0) {
      this.graphics.fillStyle(0xff8800, 1)
      this.graphics.fillCircle(x, y - 12, 4)
    }
  }

  getPosition(network: RoadNetwork): { x: number, y: number, angle: number } {
    if (this.data.pathIndex >= this.data.path.length) {
      const node = network.nodes.get(this.data.currentNodeId)!
      return { x: node.x, y: node.y, angle: 0 }
    }

    const edge = this.data.path[this.data.pathIndex]

    // Determine direction
    let fromNodeId: string
    let toNodeId: string

    if (this.data.pathIndex === 0) {
      fromNodeId = this.data.currentNodeId
      toNodeId = getOtherNode(edge, fromNodeId)
    } else {
      const prevEdge = this.data.path[this.data.pathIndex - 1]
      // The "to" node of the previous edge is the "from" node of current
      fromNodeId = edge.from === prevEdge.from || edge.from === prevEdge.to
        ? edge.from : edge.to
      toNodeId = getOtherNode(edge, fromNodeId)
    }

    const fromNode = network.nodes.get(fromNodeId)!
    const toNode = network.nodes.get(toNodeId)!

    const x = fromNode.x + (toNode.x - fromNode.x) * this.data.progress
    const y = fromNode.y + (toNode.y - fromNode.y) * this.data.progress
    const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x)

    return { x, y, angle }
  }

  getCurrentEdge(): Edge | null {
    if (this.data.pathIndex >= this.data.path.length) return null
    return this.data.path[this.data.pathIndex]
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
