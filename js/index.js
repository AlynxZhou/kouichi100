"use strict";

const SCORES_PRE_LADDER = 30;
const ROW_OF_LADDERS = 7;
const HIDDEN_ROW_OF_LADDERS = 1;
const COLUMN_OF_LADDERS = 3;
const NUM_OF_CLOUDS = 5;
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

class Stage {
  constructor(document) {
    this.document = document;
    // TODO: Add sound.
    this.canvas = this.document.getElementById("stage-canvas");
    this.canvas.width = document.documentElement.clientWidth;
    this.canvas.height = document.documentElement.clientHeight;
    this.ctx = this.canvas.getContext("2d");
    this.size = {"w": this.canvas.width, "h": this.canvas.height};
    this.ladderSize = this.size.h / (ROW_OF_LADDERS - HIDDEN_ROW_OF_LADDERS);
    // Player and Trap must less then half so we can always escape.
    this.playerSize = this.ladderSize * 0.5;
    this.trapSize = this.ladderSize * 0.3;
    this.ladderStart = (this.size.w - COLUMN_OF_LADDERS * this.ladderSize) / 2;
    this.baseSpeed = this.ladderSize / 1000;
    this.clouds = [];
    this.ladders = [];
    this.traps = [];
    this.cloudImages = Array.from(this.document.querySelectorAll("#cloud-images img"));
    this.playerImage = this.document.getElementById("player-image");
    this.ladderImage = this.document.getElementById("ladder-image");
    this.trapImages = Array.from(this.document.querySelectorAll("#trap-images img"));
    this.player = null;
    this.pressed = {"up": false, "left": false, "right": false};
    this.startTime = 0;
    this.lastTime = 0;
    this.currentTime = 0;
    this.lastDirtyTalkTime = 0;
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
  onKeyUp(e) {
    e.preventDefault();
    if (e.repeat) {
      return;
    }
    if (e.key === "Up" || e.key === "ArrowUp" || e.key === "Space") {
        this.pressed.up = false;
    }
    if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "w") {
        this.pressed.left = false;
    }
    if (e.key === "Right" || e.key === "ArrowRight") {
        this.pressed.right = false;
    }
  }
  init() {
    for (let i = 0; i < NUM_OF_CLOUDS; ++i) {
      const x = Math.random() * this.size.w;
      const y = Math.random() * this.size.h;
      const w = randomRange(2, 3) * this.ladderSize;
      const h = w * 0.7;
      const cloud = new Cloud(this, x, y, w, h, randomChoice(this.cloudImages));
      cloud.setSpeed((Math.random() > 0.5 ? 1 : -1) * randomRange(0.4, 1.1) * this.ladderSize / 1000, 0);
      this.clouds.push(cloud);
    }
    const xStart = this.ladderStart;
    const yStart = -this.ladderSize * HIDDEN_ROW_OF_LADDERS;
    for (let i = 0; i < COLUMN_OF_LADDERS; ++i) {
      const column = [];
      for (let j = 0; j < ROW_OF_LADDERS; ++j) {
        const x = xStart + i * this.ladderSize;
        const y = yStart + j * this.ladderSize;
        column.push(new Ladder(this, x, y, this.ladderSize, this.ladderSize, this.ladderImage));
      }
      this.ladders.push(column);
    }
    this.player = new Player(this, this.playerSize, this.playerSize, this.playerImage);
    this.draw();
    this.startButton.addEventListener("click", this.start.bind(this));
    this.restartButton.addEventListener("click", () => {window.location.reload();});
    this.document.addEventListener("keydown", this.onKeyDown.bind(this));
    this.document.addEventListener("keyup", this.onKeyUp.bind(this));
    this.beforeGameCard.style.display = "block";
    this.afterGameCard.style.display = "none";
  }
  onTouchEnd(e) {
    if (e.touches.length > 0) {
      // Still fingers on phone, we only handle one figner.
      return;
    }
    if (e.changedTouches[0].clientX < document.documentElement.clientWidth / 2) {
      this.pressed.left = true;
    } else {
      this.pressed.right = true;
    }
  }
  start() {
    this.beforeGameCard.style.display = "none";
    this.afterGameCard.style.display = "none";
    this.state = Stage.GAME;
    this.document.addEventListener("touchend", this.onTouchEnd);
    this.animate(window.performance.now());
  }
  stop(trap) {
    this.document.removeEventListener("touchend", this.onTouchEnd);
    this.state = Stage.AFTER_GAME;
    this.trapNameText.innerHTML = trap.name;
    this.resultScoresText.innerHTML = `${this.scores}`;
    this.resultLevelText.innerHTML = this.getLevelByScores();
    this.beforeGameCard.style.display = "none";
    this.afterGameCard.style.display = "block";
  }
  boostPlayer() {
    if (!this.pressed.up && !this.pressed.left && !this.pressed.right) {
      return;
    }
    let column = this.player.column;
    if (this.pressed.up) {
      // TODO: Use tools.
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
    this.player.setColumn(column);
  }
  getSpeedByScores() {
    return this.baseSpeed * (3000 + this.scores) / 3000;
  }
  setCloudsSpeed() {
    const y = this.baseSpeed;
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
  update(time) {
    this.currentTime = time;
    if (this.startTime === 0) {
      this.startTime = this.lastTime = this.currentTime;
      return;
    }
    const timeDelta = this.currentTime - this.lastTime;
    for (const cloud of this.clouds) {
      cloud.move(timeDelta);
    }
    for (const column of this.ladders) {
      for (const ladder of column) {
        ladder.move(timeDelta);
      }
    }
    for (const trap of this.traps) {
      trap.move(timeDelta);
    }
    this.lastTime = this.currentTime;
    for (let cloud of this.clouds) {
      if (cloud.position.x + cloud.size.w < 0 || cloud.position.x > this.size.w) {
        cloud.setSpeed(-cloud.speed.x, cloud.speed.y);
      }
      if (cloud.position.y > this.size.h) {
        cloud.setPosition(cloud.position.x, -cloud.size.h);
      }
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
        this.scoresText.innerHTML = `${this.scores}`;
        const level = this.getLevelByScores();
        if (this.lastLevel !== level) {
          this.levelText.innerHTML = this.lastLevel = level;
          this.dirtyTalkText.innerHTML = randomChoice(DIRTY_TALKS);
          this.dirtyTalkCard.style.display = "block";
          this.lastDirtyTalkTime = this.currentTime;
        }
        if (this.dirtyTalkCard.style.display === "block" &&
            this.currentTime - this.lastDirtyTalkTime > DIRTY_TALK_TIMEOUT) {
          this.dirtyTalkCard.style.display = "none";
        }
        // Choose one column to generate trap.
        if (Math.random() < percentRange(this.scores / 8888, 0.3, 1)) {
          const column = randomChoice(this.ladders);
          const ladder = column[0];
          const image = randomChoice(this.trapImages);
          this.traps.push(
            new Trap(this, ladder.position.x + (this.ladderSize - this.trapSize) / 2, ladder.position.y, this.trapSize, this.trapSize, image.alt, image)
          );
        }
      } else {
        break;
      }
    }
    // Elegant way to delete traps.
    this.traps = this.traps.filter((e, i, a) => {
      return e.position.y <= this.size.h;
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
  draw() {
    this.ctx.clearRect(0, 0, this.size.w, this.size.h);
    // Background.
    this.ctx.fillStyle = this.getSkyColorByTime();
    this.ctx.fillRect(0, 0, this.size.w, this.size.h);
    for (const cloud of this.clouds) {
      cloud.draw(this.ctx);
    }
    for (const column of this.ladders) {
      for (const ladder of column) {
        ladder.draw(this.ctx);
      }
    }
    this.player.draw(this.ctx);
    for (const trap of this.traps) {
      trap.draw(this.ctx);
    }
  }
  detectCollision(player, trap) {
    // TODO: Traps seems always sorted in y axis naturally,
    // maybe no need to iterate?
    const playerLeft = player.position.x;
    const playerRight = player.position.x + player.size.w;
    const playerTop = player.position.y;
    const playerBottom = player.position.y + player.size.h;
    const trapLeft = trap.position.x;
    const trapRight = trap.position.x + trap.size.w;
    const trapTop = trap.position.y;
    const trapBottom = trap.position.y + trap.size.h;
    return (trapRight > playerLeft && trapLeft < playerRight && trapBottom > playerTop && trapTop < playerBottom);
  }
  checkResult() {
    for (const trap of this.traps) {
      if (this.detectCollision(this.player, trap)) {
        this.stop(trap);
        return false;
      }
    }
    return true;
  }
  animate(time) {
    this.boostPlayer();
    this.setCloudsSpeed();
    this.setLaddersSpeed();
    this.setTrapsSpeed();
    // Move all actor.
    this.update(time);
    this.draw();
    if (this.checkResult()) {
      window.requestAnimationFrame(this.animate.bind(this));
    }
  }
}

Stage.BEFORE_GAME = 1;
Stage.GAME = 2;
Stage.AFTER_GAME = 3;

class Cloud {
  constructor(stage, x, y, w, h, image) {
    this.stage = stage;
    this.position = {x, y};
    this.speed = {"x": 0, "y": 0};
    this.size = {w, h};
    this.image = image;
  }
  move(timeDelta) {
    this.position.x += this.speed.x * timeDelta;
    this.position.y += this.speed.y * timeDelta;
  }
  setPosition(x, y) {
    this.position = {x, y};
  }
  setSpeed(x, y) {
    this.speed = {x, y};
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

class Ladder {
  constructor(stage, x, y, w, h, image) {
    this.stage = stage;
    this.position = {x, y};
    this.speed = {"x": 0, "y": 0};
    this.size = {w, h};
    this.image = image;
  }
  move(timeDelta) {
    this.position.x += this.speed.x * timeDelta;
    this.position.y += this.speed.y * timeDelta;
  }
  setPosition(x, y) {
    this.position = {x, y};
  }
  setSpeed(x, y) {
    this.speed = {x, y};
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

class Trap {
  constructor(stage, x, y, w, h, name, image) {
    this.stage = stage;
    this.name = name;
    this.position = {x, y};
    this.speed = {"x": 0, "y": 0};
    this.size = {w, h};
    this.image = image;
  }
  move(timeDelta) {
    this.position.x += this.speed.x * timeDelta;
    this.position.y += this.speed.y * timeDelta;
  }
  setPosition(x, y) {
    this.position = {x, y};
  }
  setSpeed(x, y) {
    this.speed = {x, y};
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

class Player {
  constructor(stage, w, h, image) {
    this.stage = stage;
    this.column = 1;
    this.position = {"x": 0, "y": 0};
    this.size = {w, h};
    this.image = image;
    this.setColumn(1);
  }
  setColumn(column) {
    this.column = column;
    this.updatePositionByColumn();
  }
  updatePositionByColumn() {
    const ladderSize = this.stage.ladderSize;
    this.setPosition(this.stage.ladderStart + this.column * ladderSize + (ladderSize - this.size.w) / 2, this.stage.size.h - this.size.h);
  }
  setPosition(x, y) {
    this.position = {x, y};
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

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

const run = () => {
  const stage = new Stage(document, "stage-canvas", "scores", "levels");
  stage.init();
};

documentReady(run);
