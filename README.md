# Rush Hour Snow

A browser-based snow plow dispatch game built with Phaser 3 and TypeScript. Manage plows and tow trucks to keep a highway network clear during a snowstorm.

## Gameplay

Snow accumulates continuously on roads. Cars spawn at endpoints and travel between locations. When snow gets too deep, cars get stuck and need to be towed.

**Controls:**
- Click on a road segment to dispatch a plow
- Click on an intersection to toggle blocking (prevents traffic)

Plows clear snow as they travel. Tow trucks automatically dispatch when cars get stuck.

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Building

```bash
npm run build
```

Output goes to `dist/`.

## Project structure

```
src/
  main.ts           # Phaser game config and entry point
  scenes/
    GameScene.ts    # Main game loop, entity management
  data/
    RoadNetwork.ts  # Graph-based road network (nodes + edges)
  entities/
    Car.ts          # Vehicle that travels between endpoints
    Plow.ts         # Snow plow that clears roads
    TowTruck.ts     # Rescues stuck cars
    Road.ts         # Visual road segment
    Intersection.ts # Clickable intersection node
  systems/
    SnowSystem.ts   # Snow accumulation and clearing
    TrafficSystem.ts # Car spawning and routing
    PathFinding.ts  # A* pathfinding for vehicles
```

## How it works

The road network is a graph with nodes (intersections, endpoints, depot) and edges (road segments). Each edge tracks snow accumulation (0-10+ scale).

**Snow levels:**
- Clear (0-2): Normal driving
- Light (2-5): Slight slowdown
- Moderate (5-8): Significant slowdown
- Deep (9+): Cars get stuck

Plows dispatch from the depot, travel to the target road via pathfinding, clear snow while moving, then return. Tow trucks work similarly but target stuck cars.

## Tech

- [Phaser 3](https://phaser.io/) - Game framework
- TypeScript
- Vite - Build tool
