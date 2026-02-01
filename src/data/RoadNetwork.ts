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

// Create the highway + exits layout
export function createDefaultNetwork(): RoadNetwork {
  const nodes = new Map<string, Node>()
  const edges = new Map<string, Edge>()
  const adjacency = new Map<string, string[]>()

  // Highway endpoints
  nodes.set('west', { id: 'west', x: 50, y: 300, type: 'endpoint' })
  nodes.set('east', { id: 'east', x: 750, y: 300, type: 'endpoint' })

  // Highway intersections (where exits connect)
  nodes.set('int-a', { id: 'int-a', x: 250, y: 300, type: 'intersection' })
  nodes.set('int-b', { id: 'int-b', x: 500, y: 300, type: 'intersection' })

  // Exit endpoints (north and south of intersections)
  nodes.set('exit-a-north', { id: 'exit-a-north', x: 250, y: 100, type: 'endpoint' })
  nodes.set('exit-a-south', { id: 'exit-a-south', x: 250, y: 500, type: 'endpoint' })
  nodes.set('exit-b-north', { id: 'exit-b-north', x: 500, y: 100, type: 'endpoint' })
  nodes.set('exit-b-south', { id: 'exit-b-south', x: 500, y: 500, type: 'endpoint' })

  // Plow depot
  nodes.set('depot', { id: 'depot', x: 50, y: 400, type: 'depot' })

  // Highway segments
  addEdge('hw-1', 'west', 'int-a')
  addEdge('hw-2', 'int-a', 'int-b')
  addEdge('hw-3', 'int-b', 'east')

  // Exit ramps
  addEdge('exit-a-n', 'int-a', 'exit-a-north')
  addEdge('exit-a-s', 'int-a', 'exit-a-south')
  addEdge('exit-b-n', 'int-b', 'exit-b-north')
  addEdge('exit-b-s', 'int-b', 'exit-b-south')

  // Depot connection
  addEdge('depot-road', 'depot', 'west')

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
