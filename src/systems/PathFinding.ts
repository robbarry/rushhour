// A* pathfinding on the road network

import { RoadNetwork, Edge, getOtherNode } from '../data/RoadNetwork'

interface PathNode {
  nodeId: string
  g: number // Cost from start
  h: number // Heuristic to goal
  f: number // g + h
  parent: PathNode | null
  edge: Edge | null // Edge used to reach this node
}

export interface PathOptions {
  ignoreBlocked?: boolean
  ignoreSnow?: boolean
}

export function findPath(
  network: RoadNetwork,
  startNodeId: string,
  goalNodeId: string,
  options: PathOptions | boolean = false // Backwards compatibility for boolean
): Edge[] | null {
  const start = network.nodes.get(startNodeId)
  const goal = network.nodes.get(goalNodeId)

  if (!start || !goal) return null

  // Handle legacy boolean argument
  const opts: PathOptions = typeof options === 'boolean' 
    ? { ignoreBlocked: options } 
    : options

  const openSet = new Map<string, PathNode>()
  const closedSet = new Set<string>()

  const startNode: PathNode = {
    nodeId: startNodeId,
    g: 0,
    h: heuristic(start.x, start.y, goal.x, goal.y),
    f: 0,
    parent: null,
    edge: null
  }
  startNode.f = startNode.g + startNode.h
  openSet.set(startNodeId, startNode)

  while (openSet.size > 0) {
    // Get node with lowest f score
    let current: PathNode | null = null
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node
      }
    }

    if (!current) break

    if (current.nodeId === goalNodeId) {
      // Reconstruct path
      return reconstructPath(current)
    }

    openSet.delete(current.nodeId)
    closedSet.add(current.nodeId)

    // Explore neighbors
    const edgeIds = network.adjacency.get(current.nodeId) || []
    for (const edgeId of edgeIds) {
      const edge = network.edges.get(edgeId)!

      // Skip blocked edges unless we're ignoring them
      if (edge.blocked && !opts.ignoreBlocked) continue

      const neighborId = getOtherNode(edge, current.nodeId)
      if (closedSet.has(neighborId)) continue

      const neighbor = network.nodes.get(neighborId)!

      // Cost includes snow level (slows down travel)
      let snowPenalty = 0
      if (!opts.ignoreSnow) {
        snowPenalty = Math.min(edge.snow * 0.5, 5) * 10
      }

      const edgeCost = distance(
        network.nodes.get(current.nodeId)!.x,
        network.nodes.get(current.nodeId)!.y,
        neighbor.x,
        neighbor.y
      ) + snowPenalty

      const tentativeG = current.g + edgeCost

      const existing = openSet.get(neighborId)
      if (existing && tentativeG >= existing.g) continue

      const h = heuristic(neighbor.x, neighbor.y, goal.x, goal.y)
      const pathNode: PathNode = {
        nodeId: neighborId,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
        edge
      }

      openSet.set(neighborId, pathNode)
    }
  }

  return null // No path found
}

function reconstructPath(node: PathNode): Edge[] {
  const path: Edge[] = []
  let current: PathNode | null = node

  while (current && current.edge) {
    path.unshift(current.edge)
    current = current.parent
  }

  return path
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  // Use Euclidean distance to match cost function and be admissible
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}