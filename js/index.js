"use strict";
const SCORES_PRE_LADDER = 30;
const MAX_TRAP_SCORES = 8888;
const ROW_OF_LADDERS = 7;
const HIDDEN_ROW_OF_LADDERS = 1;
const COLUMN_OF_LADDERS = 3;
const NUM_OF_CLOUDS = 5;
const FRAME_BLINK_TIMEOUT = 500;
const SMOKE_TIMEOUT = 300;
const DIRTY_TALK_TIMEOUT = 5000;
const DIRTY_TALKS = [
  "你不会以为你对这个游戏的理解能达到我的皮毛吧！",
  "从 Dota 2 这个维度如果我不算大神，那这个世界就没有大神了。",
  "军团一个支配给我打了 400 块了！",
  "有些人肤浅得不知道怎么说才好，看我打肿你们的脸！",
  "我像猪一样肥！",
  "你到底想不想赢啊？",
  "想想办法啊水友们！"
];
const MIN_SCORE_OF_LEVELS = [
  {"minScore": 0, "level": "先锋"},
  {"minScore": 900, "level": "卫士"},
  {"minScore": 1750, "level": "中军"},
  {"minScore": 2650, "level": "统帅"},
  {"minScore": 3350, "level": "传奇"},
  {"minScore": 4250, "level": "万古流芳"},
  {"minScore": 5100, "level": "超凡入圣"},
  {"minScore": 6000, "level": "冠绝一世"}
];

const percentRange = (percent, from, to) => {
  return percent * (to - from) + from;
};

const randomRange = (from, to) => {
  return percentRange(Math.random(), from, to);
};

const randomChoice = (array) => {
  return array[Math.floor(randomRange(0, array.length))];
};

const hideElement = (element) => {
  element.style.display = "none";
};

const showElement = (element) => {
  element.style.display = "block";
};

const setElementText = (element, text) => {
  element.textContent = text;
};

const strokeCircle = (ctx, center, radius) => {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.stroke();
};

const drawBorderedText = (ctx, text, x, y, w, h) => {
  const fontSize = Math.floor(w / text.length);
  const center = {"x": x + w / 2, "y": y + h / 2};
  // We use divide for font size so monospace is needed.
  ctx.font = `${fontSize}px monospace`;
  // We want to put texts in center.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillText(text, center.x, center.y);
  ctx.strokeStyle = "rgb(255, 255, 255)";
  ctx.lineWidth = Math.max(1, Math.floor(fontSize / 20));
  ctx.strokeText(text, center.x, center.y);
};

class ImageAsset {
  constructor(src, alt = null) {
    this.src = src;
    this.alt = alt;
    this.loaded = false;
    this.image = null;
  }

  loadAsync(onStart, onLoad, onError) {
    return new Promise((resolve, reject) => {
      this.image = new window.Image();
      this.image.addEventListener("load", () => {
        this.loaded = true;
        if (onLoad != null) {
          onLoad(this);
        }
        resolve();
      });
      this.image.addEventListener("error", () => {
        // We'll use Promise.all() and will ignore unloaded
        // images so just call resolve() instead of reject() here.
        this.loaded = false;
        if (onError != null) {
          onError(this);
        }
        resolve();
      });
      if (this.alt != null) {
        this.image.alt = this.alt;
      }
      // Set image src after setting event listener,
      // so events won't fire before setting event listener.
      this.image.src = this.src;
      if (onStart != null) {
        onStart(this);
      }
    });
  }
}

class Actor {
  constructor(stage, x, y, w, h, asset) {
    this.stage = stage;
    this.position = {x, y};
    this.speed = {"x": 0, "y": 0};
    this.size = {w, h};
    this.asset = asset;
  }

  move(lastTime, currentTime) {
    const timeDelta = currentTime - lastTime;
    this.position.x += this.speed.x * timeDelta;
    this.position.y += this.speed.y * timeDelta;
  }

  setPosition(x, y) {
    this.position = {x, y};
  }

  setSpeed(x, y) {
    this.speed = {x, y};
  }

  getCenter() {
    return {
      "x": this.position.x + this.size.w / 2,
      "y": this.position.y + this.size.h / 2
    };
  }

  draw(ctx) {
    // Some assets may fail to load.
    if (this.asset.loaded) {
      ctx.drawImage(
        this.asset.image,
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
    } else if (this.asset.alt != null) {
      drawBorderedText(
        ctx,
        this.asset.alt,
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
    }
  }
}

class Cloud extends Actor {
}

class Ladder extends Actor {
}

class Trap extends Actor {
  constructor(stage, x, y, w, h, asset, name, column) {
    super(stage, x, y, w, h, asset);
    this.name = name;
    this.column = column;
    // Invalid by item.
    this.invalid = false;
    this.used = false;
  }

  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addRedSmokeForTrap(this);
      --this.stage.player.lives;
    }
  }

  draw(ctx) {
    if (!this.used && !this.invalid) {
      super.draw(ctx);
      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.lineWidth = Math.max(1, Math.floor(this.size.w / 15));
      ctx.strokeRect(
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
    }
  }
}

class Item extends Actor {
  constructor(stage, x, y, w, h, asset, name) {
    super(stage, x, y, w, h, asset);
    this.name = name;
    this.used = false;
  }

  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addWhiteSmokeForItem(this);
    }
  }

  draw(ctx) {
    if (!this.used) {
      super.draw(ctx);
      const center = this.getCenter();
      const radius = this.size.w / 2;
      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.lineWidth = Math.max(1, Math.floor(this.size.w / 15));
      strokeCircle(ctx, center, radius);
    }
  }
}

class Immortal extends Item {
  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addWhiteSmokeForItem(this);
      ++this.stage.player.lives;
    }
  }
}

class Aeon extends Item {
  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addWhiteSmokeForItem(this);
      const column = Math.floor(randomRange(0, this.stage.ladders.length));
      for (const trap of this.stage.traps) {
        if (trap.column === column) {
          trap.invalid = true;
          this.stage.addBlackSmokeForTrap(trap);
        }
      }
    }
  }
}

class Sphere extends Item {
  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addWhiteSmokeForItem(this);
      const trap = randomChoice(this.stage.traps);
      // Maybe no trap on screen.
      if (trap != null) {
        trap.invalid = true;
        this.stage.addBlackSmokeForTrap(trap);
      }
    }
  }
}

const TYPES_TO_ITEMS = {
  "immortal": Immortal,
  "aeon": Aeon,
  "sphere": Sphere
};

class Player extends Actor {
  constructor(stage, w, h, asset) {
    super(stage, 0, 0, w, h, asset);
    this.startPosition = null;
    this.destination = null;
    this.startTime = 0;
    this.duration = 100;
    this.lives = 1;
    this.column = 1;
    this.position = this.getPositionByColumn(this.column);
  }

  moveTo(destination, startTime, duration = 100) {
    this.destination = destination;
    this.startPosition = this.position;
    this.startTime = startTime;
    this.duration = 100;
  }

  move(lastTime, currentTime) {
    if (this.destination == null) {
      return;
    }
    const timeDelta = currentTime - this.startTime;
    if (timeDelta >= this.duration) {
      this.position = this.destination;
      this.destination = this.startPosition = null;
      this.startTime = 0;
      this.duration = 100;
    } else {
      const percent = timeDelta / this.duration;
      this.setPosition(
        percentRange(percent, this.startPosition.x, this.destination.x),
        percentRange(percent, this.startPosition.y, this.destination.y)
      );
    }
  }

  getPositionByColumn(column) {
    const ladderSize = this.stage.ladderSize;
    return {
      "x": this.stage.ladderStart + column * ladderSize +
        (ladderSize - this.size.w) / 2,
      "y": this.stage.size.h - this.size.h
    };
  }

  setColumn(column, startTime) {
    this.column = column;
    this.moveTo(this.getPositionByColumn(column), startTime);
  }

  draw(ctx) {
    super.draw(ctx);
    // Only draw border when player's image failed to load.
    if (!this.asset.loaded) {
      const center = this.getCenter();
      const radius = this.size.w / 2;
      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.lineWidth = Math.max(1, Math.floor(this.size.w / 15));
      strokeCircle(ctx, center, radius);
    }
  }
}

class Smoke extends Actor {
  constructor(stage, x, y, w, h, assets, startTime) {
    super(stage, x, y, w, h, assets[0]);
    this.assets = assets;
    this.startTime = startTime;
    this.finished = false;
  }

  move(lastTime, currentTime) {
    if (this.finished) {
      return;
    }
    const timeDelta = currentTime - this.startTime;
    if (timeDelta >= SMOKE_TIMEOUT) {
      this.finished = true;
    } else {
      const percent = timeDelta / SMOKE_TIMEOUT;
      this.asset = this.assets[
        Math.floor(percentRange(percent, 0, this.assets.length))
      ];
    }
  }

  draw(ctx) {
    if (!this.finished) {
      super.draw(ctx);
    }
  }
}

class Stage {
  constructor(document) {
    this.document = document;
    // TODO: Add sound.
    this.canvas = this.document.getElementById("stage-canvas");
    if (window.visualViewport != null) {
      this.canvas.width = Math.floor(window.visualViewport.width);
      this.canvas.height = Math.floor(window.visualViewport.height);
    } else {
      this.canvas.width = Math.floor(document.documentElement.clientWidth);
      this.canvas.height = Math.floor(document.documentElement.clientHeight);
    }
    this.ctx = this.canvas.getContext("2d");
    this.size = {"w": this.canvas.width, "h": this.canvas.height};
    this.ladderSize = this.size.h / (ROW_OF_LADDERS - HIDDEN_ROW_OF_LADDERS);
    // Player and Trap must less then half so we can always escape.
    this.playerSize = this.ladderSize * 0.5;
    this.trapSize = this.ladderSize * 0.3;
    this.itemSize = this.ladderSize * 0.3;
    this.ladderStart = (this.size.w - COLUMN_OF_LADDERS * this.ladderSize) / 2;
    this.baseSpeed = this.ladderSize / 1000;
    this.smokes = [];
    this.clouds = [];
    this.ladders = [];
    this.traps = [];
    this.items = [];
    this.lastTrap = null;
    this.playerImage = new ImageAsset("images/kouichi.png", "Player");
    this.ladderImage = new ImageAsset("images/ladder.png", "Ladder");
    this.trapImages = [
      new ImageAsset("images/traps/chaos-meteor.png", "陨石"),
      new ImageAsset("images/traps/devour.png", "铁头哥哥"),
      new ImageAsset("images/traps/doom.png", "末日大"),
      new ImageAsset("images/traps/infernal-blade.png", "烈火刀"),
      new ImageAsset("images/traps/sun-strike.png", "天火"),
      new ImageAsset("images/traps/drunken-brawler.png", "醉拳"),
      new ImageAsset("images/traps/horn-toss.png", "颠勺"),
      new ImageAsset("images/traps/land-mines.png", "地雷"),
      new ImageAsset("images/traps/walrus-punch.png", "海象神拳")
    ];
    this.immortalImage = new ImageAsset(
      "images/items/aegis-of-the-immortal.png",
      "不朽之守护"
    );
    this.itemImages = [
      {"type": "immortal", "asset": this.immortalImage},
      {
        "type": "aeon",
        "asset": new ImageAsset("images/items/aeon-disk.png", "永恒之盘")
      },
      {
        "type": "sphere",
        "asset": new ImageAsset("images/items/linken-s-sphere.png", "林肯法球")
      }
    ];
    this.cloudImages = [
      new ImageAsset("images/clouds/cloud1.png", "Cloud 1"),
      new ImageAsset("images/clouds/cloud2.png", "Cloud 2"),
      new ImageAsset("images/clouds/cloud3.png", "Cloud 3")
    ];
    this.blackSmokeImages = [
      new ImageAsset("images/smokes/black/1.png", "Black Smoke 1"),
      new ImageAsset("images/smokes/black/2.png", "Black Smoke 2"),
      new ImageAsset("images/smokes/black/3.png", "Black Smoke 3"),
      new ImageAsset("images/smokes/black/4.png", "Black Smoke 4"),
      new ImageAsset("images/smokes/black/5.png", "Black Smoke 5")
    ];
    this.redSmokeImages = [
      new ImageAsset("images/smokes/red/1.png", "Red Smoke 1"),
      new ImageAsset("images/smokes/red/2.png", "Red Smoke 2"),
      new ImageAsset("images/smokes/red/3.png", "Red Smoke 3"),
      new ImageAsset("images/smokes/red/4.png", "Red Smoke 4"),
      new ImageAsset("images/smokes/red/5.png", "Red Smoke 5")
    ];
    this.whiteSmokeImages = [
      new ImageAsset("images/smokes/white/1.png", "White Smoke 1"),
      new ImageAsset("images/smokes/white/2.png", "White Smoke 2"),
      new ImageAsset("images/smokes/white/3.png", "White Smoke 3"),
      new ImageAsset("images/smokes/white/4.png", "White Smoke 4"),
      new ImageAsset("images/smokes/white/5.png", "White Smoke 5")
    ];
    this.player = null;
    this.pressed = {"up": false, "left": false, "right": false};
    this.startTime = 0;
    this.lastTime = 0;
    this.currentTime = 0;
    this.lastDirtyTalkTime = 0;
    this.showDirtyTalk = false;
    this.lastFrameBlinkTime = 0;
    this.showFrameBlink = false;
    this.scores = 0;
    this.lastLevel = "先锋";
    this.state = Stage.BEFORE_GAME;
    this.scoresText = this.document.getElementById("scores");
    this.levelText = this.document.getElementById("level");
    this.loadingAssetsCard = this.document.getElementById(
      "loading-assets-card"
    );
    this.beforeGameCard = this.document.getElementById("before-game-card");
    this.startButton = this.document.getElementById("start-button");
    this.afterGameCard = this.document.getElementById("after-game-card");
    this.restartButton = this.document.getElementById("restart-button");
    this.trapNameText = this.document.getElementById("trap-name");
    this.resultScoresText = this.document.getElementById("result-scores");
    this.resultLevelText = this.document.getElementById("result-level");
    this.dirtyTalkCard = this.document.getElementById("dirty-talk-card");
    this.dirtyTalkText = this.document.getElementById("dirty-talk");
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  loadAssetsAsync() {
    const imageAssets = [this.playerImage, this.ladderImage].concat(
      this.trapImages
    ).concat(
      this.itemImages.map((o) => {return o.asset;})
    ).concat(
      this.cloudImages
    ).concat(
      this.blackSmokeImages
    ).concat(
      this.redSmokeImages
    ).concat(
      this.whiteSmokeImages
    );
    setElementText(
      this.document.getElementById("total"),
      `${imageAssets.length}`
    );
    let completed = 0;
    const completedText = this.document.getElementById("completed");
    return Promise.all(
      imageAssets.map(
        (asset) => {
          return asset.loadAsync(
            null,
            (asset) => {
              setElementText(completedText, `${++completed}`);
            },
            (asset) => {
              setElementText(completedText, `${++completed}`);
              console.warn(`Load ${asset.src} failed`);
            }
          );
        }
      )
    );
  }

  onKeyDown(e) {
    e.preventDefault();
    if (e.repeat) {
      return;
    }
    if (this.state === Stage.BEFORE_GAME) {
      if (e.key === "Enter") {
        this.startButton.click();
      }
    }
    if (this.state === Stage.AFTER_GAME) {
      if (e.key === "Enter") {
        this.restartButton.click();
      }
    }
    if (e.key === "Up" || e.key === "ArrowUp" || e.key === " ") {
      this.pressed.up = true;
    }
    if (e.key === "Left" || e.key === "ArrowLeft" ||
      e.key === "a" || e.key === "A") {
      this.pressed.left = true;
    }
    if (e.key === "Right" || e.key === "ArrowRight" ||
      e.key === "d" || e.key === "D") {
      this.pressed.right = true;
    }
  }

  run() {
    for (let i = 0; i < NUM_OF_CLOUDS; ++i) {
      const x = Math.random() * this.size.w;
      const y = Math.random() * this.size.h;
      const w = randomRange(2, 3) * this.ladderSize;
      const h = w * 0.7;
      const cloud = new Cloud(this, x, y, w, h, randomChoice(this.cloudImages));
      cloud.setSpeed(
        (Math.random() > 0.5 ? 1 : -1) * randomRange(0.4, 1.1) * this.baseSpeed,
        0
      );
      this.clouds.push(cloud);
    }
    const xStart = this.ladderStart;
    const yStart = -this.ladderSize * HIDDEN_ROW_OF_LADDERS;
    for (let i = 0; i < COLUMN_OF_LADDERS; ++i) {
      const column = [];
      for (let j = 0; j < ROW_OF_LADDERS; ++j) {
        const x = xStart + i * this.ladderSize;
        const y = yStart + j * this.ladderSize;
        column.push(
          new Ladder(
            this,
            x,
            y,
            this.ladderSize,
            this.ladderSize,
            this.ladderImage
          )
        );
      }
      this.ladders.push(column);
    }
    this.player = new Player(
      this,
      this.playerSize,
      this.playerSize,
      this.playerImage
    );
    this.draw();
    this.startButton.addEventListener("click", this.start.bind(this));
    // Just refresh page for restart.
    this.restartButton.addEventListener("click", () => {
      window.location.reload();
    });
    this.document.addEventListener("keydown", this.onKeyDown.bind(this));
    hideElement(this.loadingAssetsCard);
    hideElement(this.afterGameCard);
    showElement(this.beforeGameCard);
  }

  onTouchEnd(e) {
    if (e.touches.length > 0) {
      // Still fingers on phone, we only handle one figner.
      return;
    }
    const halfViewport = document.documentElement.clientWidth / 2;
    if (e.changedTouches[0].clientX < halfViewport) {
      this.pressed.left = true;
    } else {
      this.pressed.right = true;
    }
  }

  start() {
    hideElement(this.beforeGameCard);
    hideElement(this.afterGameCard);
    this.state = Stage.GAME;
    this.document.addEventListener("touchend", this.onTouchEnd);
    this.animate(window.performance.now());
  }

  stop(trap) {
    this.document.removeEventListener("touchend", this.onTouchEnd);
    this.state = Stage.AFTER_GAME;
    setElementText(this.trapNameText, trap.name);
    setElementText(this.resultScoresText, `${this.scores}`);
    setElementText(this.resultLevelText, this.getLevelByScores());
    hideElement(this.beforeGameCard);
    showElement(this.afterGameCard);
  }

  addBlackSmokeForTrap(trap) {
    this.smokes.push(
      new Smoke(
        this,
        trap.position.x,
        trap.position.y,
        trap.size.w,
        trap.size.h,
        this.blackSmokeImages,
        this.currentTime
      )
    );
  }

  addRedSmokeForTrap(trap) {
    this.smokes.push(
      new Smoke(
        this,
        trap.position.x,
        trap.position.y,
        trap.size.w,
        trap.size.h,
        this.redSmokeImages,
        this.currentTime
      )
    );
  }

  addWhiteSmokeForItem(item) {
    this.smokes.push(
      new Smoke(
        this,
        item.position.x,
        item.position.y,
        item.size.w,
        item.size.h,
        this.whiteSmokeImages,
        this.currentTime
      )
    );
  }

  updatePlayerColumn() {
    if (!this.pressed.up && !this.pressed.left && !this.pressed.right) {
      return;
    }
    let column = this.player.column;
    if (this.pressed.up) {
      this.pressed.up = false;
    }
    if (this.pressed.left) {
      --column;
      // One press one step.
      this.pressed.left = false;
    }
    if (this.pressed.right) {
      ++column;
      // One press one step.
      this.pressed.right = false;
    }
    if (column < 0) {
      column = 0;
    }
    if (column >= COLUMN_OF_LADDERS) {
      column = COLUMN_OF_LADDERS - 1;
    }
    this.player.setColumn(column, this.currentTime);
  }

  getSpeedByScores() {
    return this.baseSpeed * (3000 + this.scores) / 3000;
  }

  setCloudsSpeed() {
    const y = this.baseSpeed * 0.9;
    for (const cloud of this.clouds) {
      // Cloud should also move horizonally.
      cloud.setSpeed(cloud.speed.x, y);
    }
  }

  setLaddersSpeed() {
    const y = this.getSpeedByScores();
    for (const column of this.ladders) {
      for (const ladder of column) {
        ladder.setSpeed(0, y);
      }
    }
  }

  setItemsSpeed() {
    const y = this.getSpeedByScores() * 1.3;
    for (const items of this.items) {
      items.setSpeed(0, y);
    }
  }

  setTrapsSpeed() {
    const y = this.getSpeedByScores() * 1.3;
    for (const trap of this.traps) {
      trap.setSpeed(0, y);
    }
  }

  getLevelByScores() {
    let level = null;
    for (const o of MIN_SCORE_OF_LEVELS) {
      if (this.scores >= o.minScore) {
        level = o.level;
      } else {
        break;
      }
    }
    return level;
  }

  moveClouds() {
    for (const cloud of this.clouds) {
      cloud.move(this.lastTime, this.currentTime);
      if (cloud.position.x + cloud.size.w < 0 ||
        cloud.position.x > this.size.w) {
        cloud.setSpeed(-cloud.speed.x, cloud.speed.y);
      }
      if (cloud.position.y > this.size.h) {
        cloud.setPosition(cloud.position.x, -cloud.size.h);
      }
    }
  }

  moveLadders() {
    for (const column of this.ladders) {
      for (const ladder of column) {
        ladder.move(this.lastTime, this.currentTime);
      }
    }
  }

  movePlayer() {
    this.player.move(this.lastTime, this.currentTime);
  }

  moveItems() {
    for (const item of this.items) {
      item.move(this.lastTime, this.currentTime);
    }
  }

  moveTraps() {
    for (const trap of this.traps) {
      trap.move(this.lastTime, this.currentTime);
    }
  }

  moveSmokes() {
    for (const smoke of this.smokes) {
      smoke.move(this.lastTime, this.currentTime);
    }
  }

  detectItemCollision(player, item) {
    // Player and item are both circles.
    const d = this.playerSize / 2 + this.itemSize / 2;
    const playerCenter = player.getCenter();
    const itemCenter = item.getCenter();
    const v = {
      "x": playerCenter.x - itemCenter.x,
      "y": playerCenter.y - itemCenter.y
    };
    return Math.pow(v.x, 2) + Math.pow(v.y, 2) <= Math.pow(d, 2);
  }

  checkItems() {
    for (const item of this.items) {
      if (!item.used && this.detectItemCollision(this.player, item)) {
        item.use();
        break;
      }
    }
  }

  detectTrapCollision(player, trap) {
    // Player is circle, trap is rect.
    // See <https://www.zhihu.com/question/24251545/answer/27184960>.
    const playerRadius = this.playerSize / 2;
    const playerCenter = player.getCenter();
    const trapCenter = trap.getCenter();
    const h = {"x": trap.size.w / 2, "y": trap.size.h / 2};
    const v = {
      "x": Math.abs(playerCenter.x - trapCenter.x),
      "y": Math.abs(playerCenter.y - trapCenter.y)
    };
    const u = {"x": Math.max(v.x - h.x, 0), "y": Math.max(v.y - h.y, 0)};
    return Math.pow(u.x, 2) + Math.pow(u.y, 2) <= Math.pow(playerRadius, 2);
  }

  checkTraps() {
    // TODO: Traps seems always sorted in y axis naturally,
    // maybe no need to iterate?
    for (const trap of this.traps) {
      if (!trap.invalid && !trap.used &&
        this.detectTrapCollision(this.player, trap)) {
        trap.use();
        this.lastTrap = trap;
        this.showFrameBlink = true;
        this.lastFrameBlinkTime = this.currentTime;
        break;
      }
    }
  }

  update() {
    this.setCloudsSpeed();
    this.setLaddersSpeed();
    this.setItemsSpeed();
    this.setTrapsSpeed();
    // Check key press.
    this.updatePlayerColumn();
    // Actual moving animation.
    this.moveClouds();
    this.moveLadders();
    this.movePlayer();
    this.moveItems();
    this.moveTraps();
    this.moveSmokes();
    if (this.currentTime - this.lastFrameBlinkTime > FRAME_BLINK_TIMEOUT) {
      this.showFrameBlink = false;
    }
    for (let j = ROW_OF_LADDERS - 1; j > 0; --j) {
      if (this.ladders[0][j].position.y >= this.size.h) {
        for (const column of this.ladders) {
          const ladder = column.pop();
          ladder.position.y = column[0].position.y - this.ladderSize;
          column.unshift(ladder);
        }
        ++j;
        // One line finished here.
        this.scores += SCORES_PRE_LADDER;
        setElementText(this.scoresText, `${this.scores}`);
        const level = this.getLevelByScores();
        if (this.lastLevel !== level) {
          this.lastLevel = level;
          setElementText(this.levelText, level);
          setElementText(this.dirtyTalkText, randomChoice(DIRTY_TALKS));
          this.showDirtyTalk = true;
          this.lastDirtyTalkTime = this.currentTime;
        }
        if (this.currentTime - this.lastDirtyTalkTime > DIRTY_TALK_TIMEOUT) {
          this.showDirtyTalk = false;
        }
        // Choose one column to generate trap.
        if (Math.random() < percentRange(
          this.scores / MAX_TRAP_SCORES, 0.3, 1)
        ) {
          const column = Math.floor(randomRange(0, this.ladders.length));
          const ladder = this.ladders[column][0];
          const image = randomChoice(this.trapImages);
          this.traps.push(
            new Trap(
              this,
              ladder.position.x + (this.ladderSize - this.trapSize) / 2,
              ladder.position.y,
              this.trapSize,
              this.trapSize,
              image,
              image.alt,
              column
            )
          );
        } else if (Math.random() < 0.3) {
          const column = randomChoice(this.ladders);
          const ladder = column[0];
          const item = randomChoice(this.itemImages);
          this.items.push(
            new TYPES_TO_ITEMS[item.type](
              this,
              ladder.position.x + (this.ladderSize - this.itemSize) / 2,
              ladder.position.y,
              this.itemSize,
              this.itemSize,
              item.asset,
              item.asset.alt
            )
          );
        }
      } else {
        break;
      }
    }
    this.checkItems();
    this.checkTraps();
    // Elegant way to delete traps.
    this.traps = this.traps.filter((e, i, a) => {
      return !e.used && !e.invalid && e.position.y <= this.size.h;
    });
    // Elegant way to delete items.
    this.items = this.items.filter((e, i, a) => {
      return !e.used && e.position.y <= this.size.h;
    });
    // Elegant way to delete smokes.
    this.smokes = this.smokes.filter((e, i, a) => {
      return !e.finished;
    });
  }

  getSkyColorByTime() {
    const bright = {"r": 135, "g": 206, "b": 235};
    const dark = {"r": 35, "g": 45, "b": 60};
    const time = this.currentTime - this.startTime;
    const HALF_DAY = 10000;
    const halfDays = Math.floor(time / HALF_DAY);
    const isDusk = halfDays % 2 === 0;
    const toad = time % HALF_DAY;
    const percent = isDusk ? 1 - toad / HALF_DAY : toad / HALF_DAY;
    return `rgb(${
      percentRange(percent, dark.r, bright.r)
    }, ${
      percentRange(percent, dark.g, bright.g)
    }, ${
      percentRange(percent, dark.b, bright.b)
    })`;
  }

  drawSky() {
    this.ctx.fillStyle = this.getSkyColorByTime();
    this.ctx.fillRect(0, 0, this.size.w, this.size.h);
  }

  drawClouds() {
    for (const cloud of this.clouds) {
      cloud.draw(this.ctx);
    }
  }

  drawLadders() {
    for (const column of this.ladders) {
      for (const ladder of column) {
        ladder.draw(this.ctx);
      }
    }
  }

  drawPlayer() {
    this.player.draw(this.ctx);
  }

  drawTraps() {
    for (const trap of this.traps) {
      trap.draw(this.ctx);
    }
  }

  drawItems() {
    for (const item of this.items) {
      item.draw(this.ctx);
    }
  }

  drawSmokes() {
    for (const smoke of this.smokes) {
      smoke.draw(this.ctx);
    }
  }

  drawLifeIndicator() {
    const immortalSize = this.playerSize;
    if (this.immortalImage.loaded) {
      this.ctx.drawImage(
        this.immortalImage.image,
        0,
        0,
        immortalSize,
        immortalSize
      );
    } else if (this.immortalImage.alt != null) {
      drawBorderedText(
        this.ctx,
        this.immortalImage.alt,
        0,
        0,
        immortalSize,
        immortalSize
      );
    }
    const radius = immortalSize / 2;
    const center = {"x": radius, "y": radius};
    this.ctx.strokeStyle = "rgb(255, 255, 255)";
    this.ctx.lineWidth = Math.max(1, Math.floor(immortalSize / 15));
    strokeCircle(this.ctx, center, radius);
    drawBorderedText(
      this.ctx,
      `x${this.player.lives}`,
      0,
      immortalSize,
      immortalSize,
      immortalSize
    );
  }

  draw() {
    this.ctx.clearRect(0, 0, this.size.w, this.size.h);
    this.drawSky();
    if (this.showFrameBlink) {
      this.ctx.lineWidth = Math.max(1, Math.floor(this.ladderSize / 5));
      this.ctx.strokeStyle = "rgb(255, 0, 0)";
      this.ctx.strokeRect(0, 0, this.size.w, this.size.h);
    }
    this.drawClouds();
    this.drawLadders();
    this.drawPlayer();
    this.drawTraps();
    this.drawItems();
    this.drawSmokes();
    this.drawLifeIndicator();
    if (this.showDirtyTalk) {
      if (this.dirtyTalkCard.style.display === "none") {
        showElement(this.dirtyTalkCard);
      }
    } else {
      if (this.dirtyTalkCard.style.display === "block") {
        hideElement(this.dirtyTalkCard);
      }
    }
  }

  animate(time) {
    this.currentTime = time;
    if (this.startTime === 0) {
      this.startTime = this.lastTime = this.currentTime;
    }
    this.update();
    this.draw();
    this.lastTime = this.currentTime;
    if (this.player.lives > 0) {
      window.requestAnimationFrame(this.animate.bind(this));
    } else {
      this.stop(this.lastTrap);
    }
  }
}

Stage.BEFORE_GAME = 1;
Stage.GAME = 2;
Stage.AFTER_GAME = 3;

const documentReady = (callback) => {
  if (callback == null) {
    return;
  }
  if (
    document.readyState === "complete" || document.readyState === "interactive"
  ) {
    window.setTimeout(callback, 0);
  } else {
    document.addEventListener("DOMContentLoaded", callback);
  }
};

documentReady(() => {
  const stage = new Stage(document);
  stage.loadAssetsAsync().then(() => {stage.run();});
});
