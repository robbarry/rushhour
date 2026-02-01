// Road network as a graph of nodes (intersections) and edges (road segments)

export interface Node {
  id: string
  x: number
  y: number
  type: 'intersection' | 'endpoint' | 'depot'
}

export interface Edge {
  id: string
  from: string
  to: string
  snow: number // 0-10+ accumulation
  blocked: boolean
}

export interface RoadNetwork {
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  adjacency: Map<string, string[]> // nodeId -> edgeIds
}

// Create a 3x3 grid town layout with many route options
// Layout (9 intersections in a grid, 4 endpoints, depot at bottom):
//
//            [North]
//               |
//     (NW)----(NC)----(NE)
//       |   \   |   /   |
//       |    \  |  /    |
// [West]-(CW)----(CC)----(CE)-[East]
//       |    /  |  \    |
//       |   /   |   \   |
//     (SW)----(SC)----(SE)
//               |
//            [South]
//               |
//            [Depot]
//
export function createDefaultNetwork(): RoadNetwork {
  const nodes = new Map<string, Node>()
  const edges = new Map<string, Edge>()
  const adjacency = new Map<string, string[]>()

  const centerX = 400
  const centerY = 280
  const gridSpacing = 120

  // 3x3 grid of intersections
  // Row 0 (top): NW, NC, NE
  nodes.set('NW', { id: 'NW', x: centerX - gridSpacing, y: centerY - gridSpacing, type: 'intersection' })
  nodes.set('NC', { id: 'NC', x: centerX, y: centerY - gridSpacing, type: 'intersection' })
  nodes.set('NE', { id: 'NE', x: centerX + gridSpacing, y: centerY - gridSpacing, type: 'intersection' })

  // Row 1 (middle): CW, CC (center), CE
  nodes.set('CW', { id: 'CW', x: centerX - gridSpacing, y: centerY, type: 'intersection' })
  nodes.set('CC', { id: 'CC', x: centerX, y: centerY, type: 'intersection' })
  nodes.set('CE', { id: 'CE', x: centerX + gridSpacing, y: centerY, type: 'intersection' })

  // Row 2 (bottom): SW, SC, SE
  nodes.set('SW', { id: 'SW', x: centerX - gridSpacing, y: centerY + gridSpacing, type: 'intersection' })
  nodes.set('SC', { id: 'SC', x: centerX, y: centerY + gridSpacing, type: 'intersection' })
  nodes.set('SE', { id: 'SE', x: centerX + gridSpacing, y: centerY + gridSpacing, type: 'intersection' })

  // Endpoints (traffic entry/exit)
  nodes.set('north', { id: 'north', x: centerX, y: centerY - gridSpacing - 100, type: 'endpoint' })
  nodes.set('south', { id: 'south', x: centerX, y: centerY + gridSpacing + 100, type: 'endpoint' })
  nodes.set('east', { id: 'east', x: centerX + gridSpacing + 100, y: centerY, type: 'endpoint' })
  nodes.set('west', { id: 'west', x: centerX - gridSpacing - 100, y: centerY, type: 'endpoint' })

  // Depot at the very bottom
  nodes.set('depot', { id: 'depot', x: centerX, y: centerY + gridSpacing + 180, type: 'depot' })

  // === HORIZONTAL ROADS (6 roads) ===
  // Top row
  addEdge('h-nw-nc', 'NW', 'NC')
  addEdge('h-nc-ne', 'NC', 'NE')
  // Middle row
  addEdge('h-cw-cc', 'CW', 'CC')
  addEdge('h-cc-ce', 'CC', 'CE')
  // Bottom row
  addEdge('h-sw-sc', 'SW', 'SC')
  addEdge('h-sc-se', 'SC', 'SE')

  // === VERTICAL ROADS (6 roads) ===
  // Left column
  addEdge('v-nw-cw', 'NW', 'CW')
  addEdge('v-cw-sw', 'CW', 'SW')
  // Center column
  addEdge('v-nc-cc', 'NC', 'CC')
  addEdge('v-cc-sc', 'CC', 'SC')
  // Right column
  addEdge('v-ne-ce', 'NE', 'CE')
  addEdge('v-ce-se', 'CE', 'SE')

  // === DIAGONAL ROADS (4 roads through center) ===
  addEdge('d-nw-cc', 'NW', 'CC')  // NW to center
  addEdge('d-ne-cc', 'NE', 'CC')  // NE to center
  addEdge('d-sw-cc', 'SW', 'CC')  // SW to center
  addEdge('d-se-cc', 'SE', 'CC')  // SE to center

  // === ENDPOINT CONNECTIONS (4 roads) ===
  addEdge('ep-north', 'north', 'NC')
  addEdge('ep-south', 'south', 'SC')
  addEdge('ep-east', 'east', 'CE')
  addEdge('ep-west', 'west', 'CW')

  // === DEPOT ROAD ===
  addEdge('depot-road', 'depot', 'south')

  function addEdge(id: string, from: string, to: string) {
    edges.set(id, { id, from, to, snow: 0, blocked: false })

    // Bidirectional adjacency
    if (!adjacency.has(from)) adjacency.set(from, [])
    if (!adjacency.has(to)) adjacency.set(to, [])
    adjacency.get(from)!.push(id)
    adjacency.get(to)!.push(id)
  }

  return { nodes, edges, adjacency }
}

// Get the other node of an edge
export function getOtherNode(edge: Edge, nodeId: string): string {
  return edge.from === nodeId ? edge.to : edge.from
}

// Get edge between two nodes
export function getEdgeBetween(network: RoadNetwork, nodeA: string, nodeB: string): Edge | undefined {
  const edgeIds = network.adjacency.get(nodeA) || []
  for (const edgeId of edgeIds) {
    const edge = network.edges.get(edgeId)!
    if (edge.from === nodeB || edge.to === nodeB) {
      return edge
    }
  }
  return undefined
}

export function getPositionOnPath(
  network: RoadNetwork,
  path: Edge[],
  pathIndex: number,
  progress: number,
  currentStartNodeId?: string
): { x: number, y: number, angle: number } {
  if (pathIndex >= path.length) {
    // End of path - return position of the last node of the last edge
    // We need to know which end was the "end".
    // If we have currentStartNodeId, we can infer.
    // Otherwise, assume the "to" node of the last edge if it was the last step.
    // But safely, let's just return the node associated with currentStartNodeId if provided,
    // or just the 'to' of the last edge (risky if traversed backwards).
    
    // Fallback: if we are done, we are at the destination node.
    // But we don't have the destination node ID passed here explicitly unless we infer it.
    // Let's rely on the caller to handle "arrived" state, but provide a safe fallback.
    const lastEdge = path[path.length - 1]
    const node = network.nodes.get(lastEdge.to)!
    return { x: node.x, y: node.y, angle: 0 }
  }

  const edge = path[pathIndex]
  let fromNodeId: string
  let toNodeId: string

  if (pathIndex === 0) {
    // First edge. We need currentStartNodeId to know direction.
    // If not provided, we default to edge.from (arbitrary).
    fromNodeId = currentStartNodeId || edge.from
    toNodeId = getOtherNode(edge, fromNodeId)
  } else {
    // Infer direction from previous edge
    const prevEdge = path[pathIndex - 1]
    // The shared node is the "start" of the current edge
    fromNodeId = edge.from === prevEdge.from || edge.from === prevEdge.to
      ? edge.from : edge.to
    toNodeId = getOtherNode(edge, fromNodeId)
  }

  const fromNode = network.nodes.get(fromNodeId)!
  const toNode = network.nodes.get(toNodeId)!

  const x = fromNode.x + (toNode.x - fromNode.x) * progress
  const y = fromNode.y + (toNode.y - fromNode.y) * progress
  const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x)

  return { x, y, angle }
}
