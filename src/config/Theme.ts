// Centralized theme configuration for Rush Hour Snow
// Cold Night palette and game constants

// Depth layers for rendering order
// Background (0), Roads/Intersections (1-2), Tire tracks/decals (3),
// Shadows (4), Vehicles (5-10), Particles (50), UI (100)
export const DEPTH = {
  BACKGROUND: 0,
  ROAD: 1,
  ROAD_SNOW: 2,
  INTERSECTION: 3,
  TIRE_TRACKS: 4,
  SHADOW: 5,
  CAR: 6,
  PLOW: 7,
  TOW_TRUCK: 8,
  PARTICLES: 50,
  UI: 100
} as const

// Cold Night color palette
export const PALETTE = {
  // Background
  BACKGROUND: 0x1a1c29,           // Dark Slate Blue

  // Roads
  ROAD_SHOULDER: 0x252738,        // Dark shoulder (darker than asphalt)
  ROAD_ASPHALT: 0x33354a,         // Cool Gray
  ROAD_ASPHALT_HOVER: 0x444466,   // Lighter gray for hover
  ROAD_MARKING_CENTER: 0xfbbf24,  // Faded Yellow
  ROAD_MARKING_EDGE: 0x94a3b8,    // Dim White

  // Snow
  SNOW_FRESH: 0xf8fafc,           // Bright White
  SNOW_PACKED: 0xcbd5e1,          // Blue-Gray White

  // Lights
  HEADLIGHT: 0xfef3c7,            // Warm White
  TAILLIGHT: 0xef4444,            // Bright Red
  WARNING_AMBER: 0xf59e0b,        // Amber (plow warning)
  DEPOT_GLOW: 0x0ea5e9,           // Cyan

  // Vehicles
  CAR_STUCK: 0xff0000,            // Red for stuck cars
  CAR_STUCK_INDICATOR: 0xffff00,  // Yellow flash
  PLOW_ACTIVE: 0xffaa00,          // Yellow/orange plow
  PLOW_RETURNING: 0xcc8800,       // Dimmer orange
  PLOW_BLADE: 0x888888,           // Gray blade
  PLOW_FLASH: 0xff8800,           // Orange flash
  TOW_TRUCK: 0x0066cc,            // Blue tow truck
  TOW_BED: 0x444444,              // Gray bed
  TOW_TOWED_CAR: 0xff6666,        // Red indicator
  TOW_FLASH_BLUE: 0x0000ff,       // Blue flash
  TOW_FLASH_RED: 0xff0000,        // Red flash

  // Intersections
  DEPOT: 0x0066cc,                // Blue depot
  DEPOT_ICON: 0xffff00,           // Yellow triangle
  INTERSECTION: 0x333333,         // Dark intersection
  ENDPOINT: 0x555555,             // Lighter endpoint

  // UI Colors
  UI_TEXT: 0xffffff,
  UI_TEXT_MUTED: 0xaaaaaa,
  UI_SCORE: 0x00ff00,
  UI_READY: 0x88ff88,
  UI_COOLDOWN: 0xff8888,
  UI_STORM_CALM: 0x88ff88,
  UI_STORM_NORMAL: 0xffffff,
  UI_STORM_HEAVY: 0xffaa00,
  UI_STORM_BLIZZARD: 0xff4444
} as const

// Dimensions and sizes
export const DIMENSIONS = {
  // Game canvas
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,

  // Roads
  ROAD_SHOULDER_WIDTH: 28,        // Outer shoulder layer
  ROAD_WIDTH: 24,                 // Inner asphalt layer
  ROAD_HIT_PADDING: 10,           // Extra hit area around roads
  ROAD_MARKING_WIDTH: 2,
  ROAD_EDGE_LINE_WIDTH: 1,        // White edge lines
  ROAD_EDGE_LINE_OFFSET: 10,      // Distance from center to edge lines

  // Vehicles
  CAR_SIZE: 12,
  PLOW_SIZE: 18,
  TOW_TRUCK_SIZE: 16,

  // Intersections
  INTERSECTION_RADIUS: 16,
  DEPOT_ICON_SIZE: 6,             // Triangle half-width

  // Particles
  SNOWFLAKE_SIZE: 8,
  SNOWFLAKE_RADIUS: 4,

  // Lights
  WARNING_LIGHT_RADIUS: 4,
  WARNING_LIGHT_OFFSET: 12        // Above vehicle
} as const

// Timing constants
export const TIMING = {
  // Flash intervals (ms)
  CAR_STUCK_FLASH: 300,
  PLOW_FLASH: 200,
  TOW_FLASH: 250,

  // Cooldowns
  PLOW_COOLDOWN: 2000             // 2 seconds
} as const

// Snow overlay opacity thresholds
export const SNOW_OVERLAY = {
  ROAD_INNER_REDUCTION: 4,        // Snow overlay narrower than road
  ALPHA_CLEAR_MAX: 0.2,
  ALPHA_LIGHT_MAX: 0.4,
  ALPHA_MODERATE_MAX: 0.6,
  ALPHA_DEEP_MAX: 0.9
} as const

// Vehicle speeds
export const SPEEDS = {
  PLOW: 150,
  TOW_TRUCK: 120
} as const
