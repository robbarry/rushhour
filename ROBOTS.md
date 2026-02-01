# ROBOTS.md - Rush Hour Snow

Machine-readable documentation for AI agents.

## Overview

Rush Hour Snow is a browser-based traffic simulation game built with Phaser 3 and TypeScript. Players manage snow removal on a highway network during a snowstorm by dispatching plows and handling stuck vehicles with tow trucks.

**Stack:** TypeScript, Phaser 3.80, Vite 5, ES Modules

## Quick Start

```bash
# Install dependencies
npm install

# Run development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs at `http://localhost:5173` by default.

## Project Structure

```
rushhour/
├── src/
│   ├── main.ts              # Entry point, Phaser config
│   ├── data/
│   │   └── RoadNetwork.ts   # Graph data structure
│   ├── entities/
│   │   ├── Car.ts           # Car rendering
│   │   ├── Intersection.ts  # Node rendering
│   │   ├── Plow.ts          # Snow plow entity
│   │   ├── Road.ts          # Edge rendering
│   │   └── TowTruck.ts      # Tow truck entity
│   ├── scenes/
│   │   └── GameScene.ts     # Main game logic
│   └── systems/
│       ├── PathFinding.ts   # A* algorithm
│       ├── SnowSystem.ts    # Snow accumulation
│       └── TrafficSystem.ts # Car spawning/routing
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture

### Data Layer (`src/data/`)

#### RoadNetwork.ts

Graph representation of the road network.

```typescript
interface Node {
  id: string
  x: number
  y: number
  type: 'intersection' | 'endpoint' | 'depot'
}

interface Edge {
  id: string
  from: string       // Node ID
  to: string         // Node ID
  snow: number       // 0-10+ accumulation level
  blocked: boolean   // If blocked by police
}

interface RoadNetwork {
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  adjacency: Map<string, string[]>  // nodeId -> edgeIds
}
```

**Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `createDefaultNetwork` | `() => RoadNetwork` | Creates the default highway layout |
| `getOtherNode` | `(edge: Edge, nodeId: string) => string` | Gets the node on the other end of an edge |
| `getEdgeBetween` | `(network: RoadNetwork, nodeA: string, nodeB: string) => Edge \| undefined` | Finds edge connecting two nodes |

**Default Network Layout:**

```
                   exit-a-north                    exit-b-north
                        |                              |
                        |                              |
depot --- west ----- int-a --------------- int-b ----- east
                        |                              |
                        |                              |
                   exit-a-south                   exit-b-south
```

Node IDs: `west`, `east`, `int-a`, `int-b`, `exit-a-north`, `exit-a-south`, `exit-b-north`, `exit-b-south`, `depot`

Edge IDs: `hw-1`, `hw-2`, `hw-3`, `exit-a-n`, `exit-a-s`, `exit-b-n`, `exit-b-s`, `depot-road`

### Systems Layer (`src/systems/`)

#### SnowSystem.ts

Manages snow accumulation on roads.

```typescript
const SNOW_LEVELS = {
  CLEAR: 2,      // Passable, no penalty
  LIGHT: 5,      // Slowed traffic
  MODERATE: 8,   // Heavily slowed
  DEEP: 9        // Cars get stuck
}

class SnowSystem {
  constructor(network: RoadNetwork)
  update(delta: number): void              // Called each frame, accumulates snow
  clearSnow(edgeId: string, amount: number): void
  getSnowLevel(snow: number): 'clear' | 'light' | 'moderate' | 'deep'
  setAccumulationRate(rate: number): void  // Default: 0.3 units/sec
}
```

**Snow Behavior:**
- Accumulates at 0.3 units/second on all edges except `depot-road`
- At `DEEP` level (9+), cars become stuck and require tow trucks
- Plows clear 15 units/second while moving forward

#### TrafficSystem.ts

Spawns and manages vehicle routing.

```typescript
interface CarData {
  id: string
  currentNodeId: string
  destinationNodeId: string
  path: Edge[]
  pathIndex: number
  progress: number     // 0-1 along current edge
  speed: number        // 100-150 pixels/sec base
  stuck: boolean
  stuckTime: number
}

class TrafficSystem {
  constructor(network: RoadNetwork)
  update(delta: number): void
  getCars(): CarData[]
  removeCar(carId: string): void
  setCarStuck(carId: string, stuck: boolean): void
  getCarPosition(car: CarData): { x: number, y: number }
  getCurrentEdge(car: CarData): Edge | null
}
```

**Spawning:**
- New car every 3000ms
- Spawns at random endpoint, routes to different random endpoint
- Endpoints: `west`, `east`, `exit-a-north`, `exit-a-south`, `exit-b-north`, `exit-b-south`

#### PathFinding.ts

A* pathfinding implementation.

```typescript
function findPath(
  network: RoadNetwork,
  startNodeId: string,
  goalNodeId: string,
  ignoreBlocked?: boolean  // default: false
): Edge[] | null
```

**Cost Calculation:**
- Base cost: Euclidean distance
- Snow penalty: `min(snow * 0.5, 5) * 10` added to edge cost
- Blocked edges skipped unless `ignoreBlocked=true`

### Entities Layer (`src/entities/`)

All entities extend Phaser graphics objects and handle their own rendering.

#### Car.ts

```typescript
class Car {
  data: CarData
  constructor(scene: Phaser.Scene, data: CarData)
  draw(x: number, y: number, angle: number): void
  destroy(): void
}
```

- Size: 12px
- Color: Hue based on ID hash, red when stuck
- Flashing yellow indicator when stuck

#### Plow.ts

```typescript
interface PlowData {
  id: string
  path: Edge[]
  pathIndex: number
  progress: number
  speed: number          // 150 pixels/sec
  returning: boolean
  currentNodeId: string
}

class Plow {
  data: PlowData
  constructor(scene: Phaser.Scene, data: PlowData)
  draw(x: number, y: number, angle: number): void
  getPosition(network: RoadNetwork): { x: number, y: number, angle: number }
  getCurrentEdge(): Edge | null
  destroy(): void
}
```

- Size: 18px
- Color: Orange (bright when plowing, darker when returning)
- Clears snow only on outbound trip

#### TowTruck.ts

```typescript
interface TowTruckData {
  id: string
  targetCarId: string
  path: Edge[]
  pathIndex: number
  progress: number
  speed: number          // 120 pixels/sec
  returning: boolean
  currentNodeId: string
  hasCar: boolean
}

class TowTruck {
  data: TowTruckData
  constructor(scene: Phaser.Scene, data: TowTruckData)
  draw(x: number, y: number, angle: number): void
  getPosition(network: RoadNetwork): { x: number, y: number, angle: number }
  getCurrentEdge(): Edge | null
  destroy(): void
}
```

- Size: 16px
- Color: Blue body
- Flashing red/blue lights
- Shows towed car indicator when `hasCar=true`

#### Road.ts

```typescript
class Road {
  edge: Edge
  constructor(scene: Phaser.Scene, edge: Edge, fromNode: Node, toNode: Node)
  updateSnow(): void    // Updates snow overlay opacity
  destroy(): void
}
```

- Road width: 24px
- Interactive: Emits `roadClicked` event on click
- Snow overlay opacity scales with accumulation

#### Intersection.ts

```typescript
class Intersection {
  node: Node
  blocked: boolean
  constructor(scene: Phaser.Scene, node: Node)
  toggleBlocked(): void
  destroy(): void
}
```

- Radius: 16px
- Only `intersection` type nodes are clickable
- Emits `intersectionToggled` event when toggled
- Shows red indicator when blocked

### Scene Layer (`src/scenes/`)

#### GameScene.ts

Main game orchestration.

```typescript
class GameScene extends Phaser.Scene {
  create(): void   // Initializes network, systems, visuals
  update(time: number, delta: number): void  // Game loop
}
```

**Event Handling:**
- `roadClicked`: Dispatches plow to clicked road
- `intersectionToggled`: Blocks/unblocks adjacent edges

**Update Loop:**
1. Update snow accumulation
2. Update road visuals
3. Update traffic system
4. Update car positions/states
5. Update plow positions
6. Update tow truck positions

## Game Config

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
}
```

## User Interactions

| Input | Action |
|-------|--------|
| Click on road | Dispatch plow from depot to that road |
| Click on intersection | Toggle police blocker (blocks all adjacent roads) |

## Common Modifications

### Change Snow Rate

```typescript
// In GameScene.create() or anywhere with snowSystem reference
this.snowSystem.setAccumulationRate(0.5)  // Faster accumulation
```

### Change Spawn Rate

```typescript
// In TrafficSystem constructor or add setter
this.spawnInterval = 1500  // Cars every 1.5 seconds
```

### Add New Road

```typescript
// In createDefaultNetwork()
nodes.set('new-node', { id: 'new-node', x: 600, y: 200, type: 'endpoint' })
addEdge('new-edge', 'int-b', 'new-node')
```

### Modify Vehicle Speed

```typescript
// In TrafficSystem.trySpawnCar()
speed: 150 + Math.random() * 100  // Faster cars

// In GameScene.dispatchPlow()
speed: 200  // Faster plows
```

## Gotchas

1. **Snow on depot-road**: The depot connection road never accumulates snow (hardcoded exception in SnowSystem).

2. **Pathfinding returns edges, not nodes**: The path is a sequence of Edge objects. Track position using `pathIndex` and `progress`.

3. **Bidirectional edges**: All edges work in both directions. Direction is determined by tracking `currentNodeId`.

4. **Blocked edges vs blocked intersections**: Clicking an intersection blocks all its adjacent edges, not the intersection itself.

5. **Plow snow clearing**: Plows only clear snow on the outbound trip (`returning: false`). They do not clear snow on the return to depot.

6. **Stuck car threshold**: Cars get stuck at snow level 9+ (`SNOW_LEVELS.DEEP`), not at the moderate level.

7. **Progress value**: The `progress` field is 0-1 representing position along current edge. Resets to 0 when moving to next edge.

8. **Delta time**: All movement uses `delta` (milliseconds). Convert to seconds: `delta / 1000`.

## Type Exports

```typescript
// From data/RoadNetwork.ts
export { Node, Edge, RoadNetwork, createDefaultNetwork, getOtherNode, getEdgeBetween }

// From systems/SnowSystem.ts
export { SnowSystem, SNOW_LEVELS }

// From systems/TrafficSystem.ts
export { TrafficSystem, CarData }

// From systems/PathFinding.ts
export { findPath }

// From entities/Plow.ts
export { Plow, PlowData }

// From entities/TowTruck.ts
export { TowTruck, TowTruckData }

// From entities/*.ts
export { Car, Road, Intersection }

// From scenes/GameScene.ts
export { GameScene }
```
