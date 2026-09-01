import backgroundUrl from "./res/background.png?url";
import flappy1Url from "./res/flappy1.png?url";
import flappy2Url from "./res/flappy2.png?url";
import flappy3Url from "./res/flappy3.png?url";
import fontUrl from "./res/font.png?url";
import groundUrl from "./res/ground.png?url";
import tubeBodyUrl from "./res/tubebody.png?url";
import tubeTopUrl from "./res/tubetop.png?url";
import type { Textures } from "./types";

function loadImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

export function loadTextures(): Textures {
  return {
    birdFrames: [
      loadImage(flappy1Url),
      loadImage(flappy2Url),
      loadImage(flappy3Url),
    ],
    background: loadImage(backgroundUrl),
    ground: loadImage(groundUrl),
    tubeBody: loadImage(tubeBodyUrl),
    tubeTop: loadImage(tubeTopUrl),
  };
}

export function loadFontBitmap(): HTMLImageElement {
  return loadImage(fontUrl);
}
