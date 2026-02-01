# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build
```

## Architecture

Rush Hour Snow is a Phaser 3 browser game simulating highway snow management. Players dispatch plows and manage traffic during a snowstorm.

### Core Systems (src/systems/)

- **SnowSystem**: Accumulates snow on roads over time. Snow levels: CLEAR (<=2), LIGHT (<=5), MODERATE (<=8), DEEP (>=9)
- **TrafficSystem**: Spawns cars at endpoints, routes them via A* pathfinding, tracks stuck vehicles
- **PathFinding**: A* implementation that factors in snow penalties and blocked edges

### Data Model (src/data/)

- **RoadNetwork**: Graph structure with nodes (intersections/endpoints/depot) and edges (road segments)
- Edges track snow accumulation and blocked state
- Adjacency map enables bidirectional traversal

### Entities (src/entities/)

All entities use Phaser Graphics for procedural rendering:

- **Car**: Colored by ID hash, turns red when stuck, has flashing warning light
- **Plow**: Dispatched from depot, clears snow while traveling, returns when done
- **TowTruck**: Auto-dispatched when cars get stuck in deep snow
- **Road**: Visual road with snow overlay, clickable to dispatch plows
- **Intersection**: Clickable to toggle road blocking

### Game Loop (GameScene)

1. SnowSystem accumulates snow on all edges
2. Road visuals update snow overlay opacity
3. TrafficSystem spawns/routes cars
4. Cars slow in snow, get stuck at DEEP level (>=9)
5. Stuck cars trigger automatic tow truck dispatch
6. Player clicks dispatch plows to target roads

### Event System

- `roadClicked`: Dispatches plow to clicked road
- `intersectionToggled`: Blocks/unblocks adjacent edges
