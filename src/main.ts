// Rush Hour Snow - Main entry point

import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'
import { PALETTE, DIMENSIONS } from './config/Theme'

// Convert hex number to #rrggbb string for Phaser config
const bgColorStr = '#' + PALETTE.BACKGROUND.toString(16).padStart(6, '0')

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: DIMENSIONS.GAME_WIDTH,
  height: DIMENSIONS.GAME_HEIGHT,
  parent: 'game',
  backgroundColor: bgColorStr,
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
}

new Phaser.Game(config)
