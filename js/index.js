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
  "我和猪一样肥！",
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

const randomChoice = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const percentRange = (percent, from, to) => {
  return percent * (to - from) + from;
};

const randomRange = (from, to) => {
  return percentRange(Math.random(), from, to);
};

const hideElement = (element) => {
  element.style.display = "none";
};

const showElement = (element) => {
  element.style.display = "block";
};

const setElementText = (element, text) => {
  element.innerHTML = text;
};

// We have less than 10 smokes so comparing string is just fine.
const compareID = (a, b) => {
  if (a.id < b.id) {
    return -1;
  } else if (a.id > b.id) {
    return 1;
  } else {
    return 0;
  }
};

class Actor {
  constructor(stage, x, y, w, h, image) {
    this.stage = stage;
    this.position = {x, y};
    this.speed = {"x": 0, "y": 0};
    this.size = {w, h};
    this.image = image;
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
    ctx.drawImage(
      this.image,
      this.position.x,
      this.position.y,
      this.size.w,
      this.size.h
    );
  }
}

class Cloud extends Actor {
  constructor(stage, x, y, w, h, image) {
    super(stage, x, y, w, h, image);
  }
}

class Ladder extends Actor {
  constructor(stage, x, y, w, h, image) {
    super(stage, x, y, w, h, image);
  }
}

class Trap extends Actor {
  constructor(stage, x, y, w, h, image, name, column) {
    super(stage, x, y, w, h, image);
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
      ctx.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
    }
  }
}

class Item extends Actor {
  constructor(stage, x, y, w, h, image, name) {
    super(stage, x, y, w, h, image);
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
      ctx.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
    }
  }
}

class Immortal extends Item {
  constructor(stage, x, y, w, h, image, name) {
    super(stage, x, y, w, h, image, name);
  }
  use() {
    if (!this.used) {
      this.used = true;
      this.stage.addWhiteSmokeForItem(this);
      ++this.stage.player.lives;
    }
  }
}

class Aeon extends Item {
  constructor(stage, x, y, w, h, image, name) {
    super(stage, x, y, w, h, image, name);
  }
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
  constructor(stage, x, y, w, h, image, name) {
    super(stage, x, y, w, h, image, name);
  }
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

const IDS_TO_ITEMS = {
  "immortal": Immortal,
  "aeon": Aeon,
  "sphere": Sphere
};

class Player extends Actor {
  constructor(stage, w, h, image) {
    super(stage, 0, 0, w, h, image);
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
}

class Smoke extends Actor {
  constructor(stage, x, y, w, h, images, startTime) {
    super(stage, x, y, w, h, images[0]);
    this.images = images;
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
      this.image = this.images[
        Math.floor(percentRange(percent, 0, this.images.length))
      ];
    }
  }
  draw(ctx) {
    if (!this.finished) {
      ctx.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.size.w,
        this.size.h
      );
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
    this.cloudImages = Array.from(
      this.document.querySelectorAll("#cloud-images img")
    );
    this.blackSmokeImages = Array.from(
      this.document.querySelectorAll("#black-smoke-images img")
    ).sort(compareID);
    this.redSmokeImages = Array.from(
      this.document.querySelectorAll("#red-smoke-images img")
    ).sort(compareID);
    this.whiteSmokeImages = Array.from(
      this.document.querySelectorAll("#white-smoke-images img")
    ).sort(compareID);
    this.playerImage = this.document.getElementById("player-image");
    this.ladderImage = this.document.getElementById("ladder-image");
    this.trapImages = Array.from(
      this.document.querySelectorAll("#trap-images img")
    );
    this.itemImages = Array.from(
      this.document.querySelectorAll("#item-images img")
    );
    this.immortalImage = this.document.getElementById("immortal");
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
    this.beforeGameCard = this.document.getElementById("before-game-card");
    this.startButton = this.document.getElementById("start-button");
    this.afterGameCard = this.document.getElementById("after-game-card");
    this.restartButton = this.document.getElementById("restart-button");
    this.trapNameText = this.document.getElementById("trap-name");
    this.resultScoresText = this.document.getElementById("result-scores");
    this.resultLevelText = this.document.getElementById("result-level");
    this.gameElement = this.document.getElementById("game");
    this.dirtyTalkMask = this.document.getElementById("dirty-talk-mask");
    this.dirtyTalkMask.style.bottom = `${this.playerSize}px`;
    this.dirtyTalkCard = this.document.getElementById("dirty-talk-card");
    this.dirtyTalkText = this.document.getElementById("dirty-talk");
    this.onTouchEnd = this.onTouchEnd.bind(this);
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
    if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "a") {
        this.pressed.left = true;
    }
    if (e.key === "Right" || e.key === "ArrowRight" || e.key === "d") {
        this.pressed.right = true;
    }
  }
  init() {
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
      // TODO
      this.pressed.up = false;
    } else if (this.pressed.left) {
      --column;
      // One press one step.
      this.pressed.left = false;
    } else if (this.pressed.right) {
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
        // Don't trigger trap again.
        item.used = true;
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
        // Don't trigger trap again.
        trap.used = true;
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
          const image = randomChoice(this.itemImages);
          this.items.push(
            new IDS_TO_ITEMS[image.id](
              this,
              ladder.position.x + (this.ladderSize - this.itemSize) / 2,
              ladder.position.y,
              this.itemSize,
              this.itemSize,
              image,
              image.alt
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
    this.ctx.drawImage(
      this.immortalImage,
      0,
      0,
      this.playerSize,
      this.playerSize
    );
    const fontSize = Math.floor(this.playerSize * 0.6);
    this.ctx.font = `${fontSize}px sans`;
    this.ctx.fillStyle = "rgb(0, 0, 0)";
    this.ctx.fillText(
      `x${this.player.lives}`,
      (this.playerSize - fontSize) / 2,
      this.playerSize + fontSize
    );
    this.ctx.strokeStyle = "rgb(255, 255, 255)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeText(
      `x${this.player.lives}`,
      (this.playerSize - fontSize) / 2,
      this.playerSize + fontSize
    );
  }
  draw() {
    this.ctx.clearRect(0, 0, this.size.w, this.size.h);
    this.drawSky();
    if (this.showFrameBlink) {
      this.ctx.lineWidth = this.ladderSize / 5;
      this.ctx.strokeStyle = "red";
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

const imagesReady = (callback) => {
  Promise.all(
    Array.from(document.images).filter((image) => {
      return !image.complete;
    }).map((image) => {
      return new Promise((resolve) => {
        image.addEventListener("load", resolve);
        image.addEventListener("error", resolve);
      });
    })
  ).then(callback);
};

documentReady(() => {
  imagesReady(() => {
    const stage = new Stage(document);
    stage.init();
  });
});
