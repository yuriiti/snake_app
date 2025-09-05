import Phaser from "phaser";
// Сцена портала (активируется, когда яблок не осталось)
import { getLevel } from "../levels/store";
import { Portal } from "../entities/Portal";
import AppleScene from "./AppleScene";
import { layoutGridContainer } from "../utils/layout";
import { LAYER_TILES, PADS } from "../constants";

export default class PortalScene extends Phaser.Scene {
  private readonly tile = LAYER_TILES.portal;
  private layer?: Phaser.GameObjects.Container;
  private rows = 0;
  private cols = 0;
  private portal?: Portal;

  constructor() {
    super({ key: "PortalScene", active: false });
  }

  preload() {}

  create() {
    this.cameras.main.roundPixels = true;
    const parsed = getLevel();
    this.rows = parsed.rows;
    this.cols = parsed.cols;
    this.portal = new Portal(this, parsed.portal, this.tile, PADS.portal);
    this.layer = this.portal.getLayer();

    // Attach apples manager from AppleScene if available
    const appleScene = this.scene.get("AppleScene") as AppleScene | undefined;
    const apples = appleScene?.getApples();
    if (apples) this.portal.attachApples(apples);
    // Subscribe to apples updates to toggle portal state
    const onLeft = (left: number) => this.portal?.setActive(left === 0);
    appleScene?.events.on("applesLeft", onLeft);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (appleScene) appleScene.events.off("applesLeft", onLeft);
    });
  }

  private layout() {
    if (!this.layer) return;
    layoutGridContainer(this, this.layer, this.cols, this.rows, this.tile);
  }
}
