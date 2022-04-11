/* BLOBBY
> You are a small blob on the screen.
> Blobs of varying sizes will appear on the edges and cross the screen.
> Avoid the blobs that are bigger than you, or else you will lose!
> Consume the blobs that are smaller than you to get bigger!
> Try to survive for as long as possible.

> OPTIONAL: Hard mode functionality with special enemy blob types, mutations and more!
*/


/*PSUEDOCODE

>GAME OPEN
1. Startup game
  1.1 Assign event listeners and click tracker
  1.2 Generate dynamic UI elements (none needed??)
  1.3 Cache global UI elements and game variables
2. Initialise gamestate
  2.1 Set up player object with size, speed, position and hitbox
  2.2 Set up array to track enemy objects on screen
  2.3 Initialise statistics tracking
3. Load UI & Spawn player
  3.1 Initialise UI elements with correct gamestate variables to display
  3.2 Initial render to display UI elements such as header, game window and player object
4. Wait for user to begin game (spacebar?)
  4.1 Process any game settings/controls
  4.2 unpause and begin game clock
  4.3 play music!

>GAME START
1. Run Game Engine (controller) at 60fps
  1.1 Process any user inputs (see below)
  1.2 Randomly spawn enemy objects with random size, speed and trajectory and add to array (push)
  1.3 Move objects across the screen (player (if key pressed) and enemies)
    1.3.1 Update positions of objects on screen at regular intervals based on speed and trajectory
      1.3.1.1 If an enemy object leaves the game screen, despawn it
      1.3.1.2 Prevent player from exiting the game window (i.e. position is not outside the borders of the window)
    1.3.2 Check and resolve collisions between objects (check is positions of hitboxes overlap)
      1.3.2.1 If the player collides with an enemy and is bigger than them, delete the enemy, update the "blobs eaten count" and make the player size bigger
      1.3.2.2 If the player collides with an enemy and is smaller than them, the player loses
      1.3.2.3 If two enemies collide with each other, they pass through each other (no bouncing... yet?)
  1.4 Render the game (see below)

2. Process user inputs
  2.1 Move player object based on keystrokes - i.e. check if player has a key pressed
  2.2 Detect if controls have been clicked
    2.2.1 Reset Button -> Reset game. i.e. return to SETUP stage 2.
    2.2.2 Clock -> Pause/unpause game engine/render
    2.2.3 Controls/settings as required
  2.3 Pause/unpause game enginer and render if spacebar is pressed

3. Render game state to screen at 60fps 
  3.1 Render player in the correct position
  3.2 Render enemy objects from array in the correct position
  3.3 Render header
    3.3.1 Update blobs eaten
    3.3.2 Update blob size
    3.3.3 Update game clock
  3.4 Render dynamic background if feeling brave
  3.5 Render win/lose screen (see below), if appropriate

>GAME END
1. Stop the game clock and the game engine
2. Display game statistics
3. Clear game window and game state data (e.g. player and enemy objects)
4. Reset to Startup step 2, if desired by user
*/


/*BLOBBY - MAIN GAME*/

/*GLOBAL CONSTANTS & VARIABLES*/
const FPS = 30; //game refresh at 30 frames per second
let CACHE = {};
let PLAYER = null; //player data obj at top, left coordinates
let GAME = {};
let enemyBlobs = []; //array of enemy objects
let keyLog = []; //array of arrow keys currently pressed

class Blob { //investigate set and get methods as well as subclasses
  constructor() {
    this.obj = document.createElement('div');

    this.speed = (Math.random() * 150 + 50)/FPS; //pixels per frame - from 50 to 200 pixels per second (player is 100)
    this.size = 10;
    if (PLAYER) {
      this.size = Math.floor((PLAYER.size * (pseudoGaussianDistribution() * 0.5 + 1))*1000)/1000; //pixels diameter scales with player size
    }
    this.decayRate = 1; //does not decay
    //blob spawn location - spawning is done radially in a circle around the center of the game window. The blob spawns somewhere on this circle oputside the game screen and is given a direction that is roughly toward the centre.
    //FANCY MATHEMATICS/TRIGONOMETRY BELOW - TRUST ME, I WORKED IT OUT ON A PIECE OF PAPER.
    let angle = Math.random() * 2 * Math.PI; //spawn angle in radians - 0 is horizontal
    this.left = CACHE.WINDOWWIDTH/2 * ( 1 + Math.max(Math.min(Math.sqrt(2) * Math.cos(angle), 1), -1)); //spawns on edge of window
    if (this.left < 1) { //adjust to spawn just outside the border
      this.left -= this.size;
    }
    this.top = CACHE.WINDOWHEIGHT/2 * ( 1 + Math.max(Math.min(Math.sqrt(2) * Math.sin(angle), 1), -1)); //spawns on edge of window
    if (this.top < 1) { //adjust to spawn just outside the border
      this.top -= this.size;
    }
    this.direction = angle + Math.PI - Math.PI/8 + Math.random() * Math.PI/8; //angle (measured from 0 radians = horizontal -> down) that the blob is travelling in
    this.AIState = 'Passive';
    this.directionChangeChance = 1;
    this.targetDirection = this.direction;
    this.currentTurningCircle = 0; //no turning
    //AI behaviour states:
    //Passive - default / ignores the player completely & moves in a straight line
    //wandering - ignores the player completely & moves randomly
    //Tracking - hones-in and follows the player
    //Fleeing - deliberately moves away from the player
    //Orbiting - circle's around the player
    //Striking - lunges straight at the player and unable to change direction


    this.hasEnteredWindow = false;

    this.id = 'b' + (Math.random() + this.speed + this.size + this.direction); //pseudo random number lol
    if (PLAYER) { //Player blob has been spawned (currently a hack catch-all)
      if (Math.floor(Math.random() * GAME.specialSpawnChance) < 1) {
        //SPECIAL BLOB
        this.reward = 2; //specials are worth double!
        
        let randRoll = Math.floor(Math.random() * 16);
        if (Math.floor(Math.random() * 2) < 1) { //50% chance of angry vs passive blob
          //agressive blobs
          this.aggressive = true; //will track the player
          if (randRoll < 1) {
            this.type = 'radioactive'; //spawns blobs around it, which decay
            this.color = 'black'; //will be random
            this.decayRate = 0.9 ** (1/FPS); //decay by 10% per s
            this.reward = -2; //radioactive is bad
            this.obj.style.boxShadow = '0px 0px 10px red';
            this.size *= 1.5; //50% bigger
            this.speed *= 0.8; //20% slower
            this.AIState = 'tracking';
          } else if (randRoll < 5) {
            this.type = 'meteor'; //burns the player to make them smaller!
            this.color = '#ffff55'; //orange-red
            this.speed = Math.max(Math.min(this.speed * 1.5, 300/FPS), 150/FPS); //max speed 300px/s, min speed 150px/s;
            this.reward = -1; //it takes away from you!
            this.size *= 0.8; //20% smaller
            this.AIState = 'tracking';
          } else if (randRoll < 9) {
            this.type = 'hawk'; //circles the player - lunges in when close!
            this.color = '#aaaa55'; //gross greeny-gold
            this.size = Math.min(Math.max(this.size * 1.2, 0.95 * PLAYER.size), 1.5 * PLAYER.size); //will atleast almost always be as big as the player
            this.baseSpeed = this.speed; //for lunging purposes
            this.isLunging = false; //for lunging purposes
            this.hasScopedPlayer = false;
            this.strikeDirection = this.direction;
          } else {
            this.type = 'tracker'; //tracks the player as opposed to going in a straight line
            this.color = '#ff5555'; //some kind of red it seems
            this.speed = Math.min(this.speed, 120/FPS); //trackers can never be faster than 120px/s
            this.size = Math.min(1.2 * this.size, 1.2 * PLAYER.size); //20% larger, but not more than 20% bigger than the player
            this.AIState = 'tracking';
          }
        } else {
          //passive blobs
          this.aggressive = false; //will not track the player
          if (randRoll < 1) {
            this.type = 'angelic'; //bonus xp
            this.color = '#d4d4d4'; //creamy white
            this.reward = 3; //even more exp for these!
          } else if (randRoll < 6) {
            this.type = 'speeder'; //goes really fast!
            this.color = '#ffaa55'; //orangey
            this.speed = Math.max(this.speed * 2, 120/FPS); //min speed 120px/s
            this.size = Math.max(this.size / 2, 5); //min 5px size
          } else if (randRoll < 11) {
            this.type = 'grower'; //gets bigger over time
            this.color = '#55ffff'; //teal-ish
          } else {
            this.type = 'jumbo'; //big and slow
            this.color = '#555555'; //grey
            this.size *= 2; //100% larger
            this.speed = (Math.random() * 30 + 20)/FPS; //speed 20 - 50
          }
        }   
      } else {
        this.type = 'normal';
        this.reward = 1;
        this.aggressive = false;
        this.color = '#aaff55';
      }
    }

    this.obj.classList.add('blob');
    this.obj.style.backgroundColor = this.color;
    this.obj.id = this.id;
    CACHE.blobWindow.appendChild(this.obj);
  }
  delete() {
    let newArr = enemyBlobs.filter(x=>{
      return x.id != this.id;
    })
    enemyBlobs = newArr;
    let blobEl = document.getElementById(this.id);
    blobEl.remove();
  }
  move() {
    if (this.aggressive) {
      //aggressive: pursue the player according to pre-set behaviour
      //Initial mathematics to locate the player for tracking behaviour
      let pXCent = PLAYER.left + PLAYER.size/2;
      let pYCent = PLAYER.top + PLAYER.size/2;
      let bXCent = this.left + this.size/2;
      let bYCent = this.top + this.size/2;

      let dx = pXCent - bXCent;
      let dy = pYCent - bYCent;

      let dist = (dx**2 + dy**2)**0.5; //shortest distance between the centre of blob and player

      let proposedAngle = Math.atan(dy/dx);

      if (dx < 0) { 
        //stops the tracking blobs from bouncing away from the centreline axis of the player
        proposedAngle += Math.PI;
      }

      //Limit amount the angle can change by
      let currentAngle = this.direction;
      let newAngle = proposedAngle; //default tracking of player

      //blob-specific tracking behaviour
      if (this.type==='meteor') {
        //Turning circle gets tighter as the meteor blob gets closer to the player; kind of similar to gravity in astrophysics... I think
        //Base turning circle of 60deg/s
        let maxTurningCircle = Math.min(60 * Math.sqrt(100/dist), 120)/FPS * Math.PI/180;
        newAngle = computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle);

      } else if (this.type==='hawk') {
        //Hawks are passive until the player comes near, then they will circle around and finally strike!
        let maxTurningCircle = 360/FPS * Math.PI/180; //hawks can turn tight 360deg/s circles!
        this.speed = this.baseSpeed
        if (this.AIState != 'striking') {
          this.strikeDirection = proposedAngle;
        }

        if (this.hasScopedPlayer && (PLAYER.size > this.size)) {
          //Has giotten close to the player and scoped it out and is smaller than the player - FLEE!
          if (currentAngle > proposedAngle + (Math.PI * 0.9) || currentAngle < proposedAngle - (Math.PI * 0.9)) {
            //player is effectively behind the hawk - it relaxes
            this.AIState = 'wandering';

            if (Math.floor(Math.random()*this.directionChangeChance)<1) {
              //pick a new direction
              this.directionChangeChance = Math.random() * 3 * FPS; //turn for approx 3s on average
              this.targetDirection = (Math.random()-0.5)*Math.PI/2+currentAngle; //up to 90degree turn
              this.currentTurningCircle = Math.random() * 60/FPS * Math.PI/180 //up to 30deg/s
            } 
            newAngle = computeTurningCircle(currentAngle,this.targetDirection,this.currentTurningCircle);
          } else {
            this.AIState = 'fleeing';
            maxTurningCircle = 180/FPS * Math.PI/180; //hawks can only turn 60deg/s when casually flying.
            newAngle = computeTurningCircle(currentAngle,proposedAngle+Math.PI,maxTurningCircle);
          }

        } else if ((dist > 300 + (PLAYER.size + this.size)/2)) {
          //If the player is far away, it will ignore the player and casually glide around the screen
          this.AIState = 'wandering';

          if (Math.floor(Math.random()*this.directionChangeChance)<1) {
            //pick a new direction
            this.directionChangeChance = Math.random() * 3 * FPS; //turn for approx 3s on average
            this.targetDirection = (Math.random()-0.5)*Math.PI/2+currentAngle; //up to 90degree turn
            this.currentTurningCircle = Math.random() * 60/FPS * Math.PI/180 //up to 30deg/s
          } 
          newAngle = computeTurningCircle(currentAngle,this.targetDirection,this.currentTurningCircle);
          
        } else if (dist > 200 + (PLAYER.size + this.size)/2) {
          //If the player is kind of close, it will begin curiously tracking to check it out
          this.AIState = 'tracking';
          maxTurningCircle = 180/FPS * Math.PI/180; //sharp turn from curiosity.
          newAngle = computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle);

        } else if (dist > 100 + (PLAYER.size + this.size)/2) {
          //Close to the player - size has been assessed. If Hawk is smaller, turn and flee. If hawk is bigger, begin circling and prepare to strike!
          this.hasScopedPlayer = true;
          this.directionChangeChance = 1;
          this.targetDirection = this.direction;
          this.currentTurningCircle = 0;

          this.speed = this.baseSpeed * 1.25; //speed up slightly
          if (PLAYER.size > (0.95 + Math.random()/10 * this.size)) {
            this.AIState = 'fleeing';
            maxTurningCircle = 180/FPS * Math.PI/180; //hawks can turn 180deg/s when fleeing or becoming alert.
            newAngle = computeTurningCircle(currentAngle,proposedAngle+Math.PI,maxTurningCircle);
          } else {
            //begin circling
            this.AIState = 'orbiting';
            maxTurningCircle = 180/FPS * Math.PI/180; //hawks can turn 180deg/s when fleeing or becoming alert.

            let adjProposedAngle = proposedAngle + (Math.PI/2 - 10 *Math.random() * Math.PI/180) * Math.sign(currentAngle - proposedAngle);
            newAngle = computeTurningCircle(currentAngle,adjProposedAngle,maxTurningCircle);
          }

        } else if (dist > 50 + (PLAYER.size + this.size)/2) {
          //very clsoe, turn toward the play to strike!
          this.AIState = 'tracking';
          this.speed = this.baseSpeed * 1.75; //speed up a lot
          maxTurningCircle = 360/FPS * Math.PI/180; //sharp turn from curiosity.
          newAngle = computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle);

        } else {
          //default straight line lunge if close to player
          this.speed = this.baseSpeed * 2.5; //speed up a lot
          this.AIState = 'striking';
          maxTurningCircle = 360/FPS * Math.PI/180; //hawks can turn 180deg/s when fleeing or becoming alert.
          newAngle = computeTurningCircle(currentAngle,this.strikeDirection,maxTurningCircle);
        }

      } else if (this.type==='tracker') {
        //Turning circle of 120 degrees/s either direction
        let maxTurningCircle = 120/FPS * Math.PI/180;
        
        if ((this.size >= (0.9 + Math.random()/5 * PLAYER.size)) || (dist + PLAYER.size/2 > CACHE.WINDOWWIDTH/2)) {
          //Tracker is approx. bigger than player, or far away - pursue
          this.AIState = 'tracking';
          newAngle = computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle);
        } else {
          //Tracker is smaller than player and close by - flee!!
          this.AIState = 'fleeing';
          newAngle = computeTurningCircle(currentAngle,proposedAngle+Math.PI,maxTurningCircle);
        }

      } else if (this.type==='radioactive') {
        //Turning circle is limited to max 180 degrees/s either direction
        let maxTurningCircle = 180/FPS * Math.PI/180;
        //Apply turning circle
        newAngle = computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle);
      }
      //Assign computed direction
      this.direction = newAngle;

    } else {
      //not aggressive, move in a straight line
    }

    this.left += this.speed * Math.cos(this.direction);
    this.top += this.speed * Math.sin(this.direction);

    //growers grow at approx. +15% per second
    if (this.type === 'grower') {
      this.size *= 1 + 0.15/FPS;
    }

    if (!this.hasEnteredWindow) {
      if ((this.left > 0) && (this.left < CACHE.WINDOWWIDTH-this.size) && (this.top > 0) && (this.top < CACHE.WINDOWHEIGHT-this.size)) {
        //Check if entire blob has entered the window
        this.hasEnteredWindow = true;
      }
    } else if (this.hasEnteredWindow && ((this.left < -this.size/2) || (this.left > CACHE.WINDOWWIDTH-this.size/2) || (this.top < -this.size/2) || (this.top > CACHE.WINDOWHEIGHT-this.size/2))) {
      //Despawn blob if centre has left the game window
      this.delete();
    }

  }
}

function main() {
  console.log('Loading Cache...')
  loadCache();
  console.log('Initialising...')
  init();
  console.log('Start game by pressing SPACE')
}

/*INITIALISATION*/
function init() {
  console.log('Resetting game state...')
  resetGamestate();
  console.log('Loading UI elements...')
  loadUI();
  console.log('Initialising the player...')
  initialisePlayer();
  console.log('Displaying...')
  render();
}

function loadCache() {
  CACHE = {
    //GAMEWINDOW
    webpage: document.querySelector('body'),
    gameWindow: document.getElementById('gameWindow'),
    playerWindow: document.getElementById('playerWindow'),

    player: document.getElementById('player'),
    blobWindow: document.getElementById('blobWindow'),

    textOverlay: document.getElementById('textOverlay'),
    startupWindow: document.getElementById('startupWindow'),
    hintText: document.getElementById('hintText'),
    yourBlobText: document.getElementById('yourBlobText'),
    winSizeText: document.getElementById('winSizeText'),

    speedBoostInfo: document.getElementById('speedBoostInfo'),
    speedBoostInfoContainer: document.getElementById('speedBoostInfoContainer'),

    gameOverWindow: document.getElementById('gameOverWindow'),
    resultsText: document.getElementById('gameResults'),
    pauseText: document.getElementById('pauseWindow'),

    //HEADER
    blobsEaten: document.getElementById('bEaten'),
    playerSize: document.getElementById('pSize'),
    gameClock: document.getElementById('gameClock'),
    help: document.getElementById('help'),
    muteSBtn: document.getElementById('muteSound'),
    muteMBtn: document.getElementById('muteMusic'),


    //AUDIO
    gameWinMusic: new Audio('assets/audio/gameWinMusic.wav'),
    gameLoseMusic: new Audio('assets/audio/gameLoseMusic.mp3'),
    gameLoseSound: new Audio('assets/audio/gameLoseSound.wav'),
    blobSpawnSound: new Audio('assets/audio/blobSpawn.wav'),
    blobEatingSound: new Audio('assets/audio/blobEaten.wav'),
    pickupPowerupSound: new Audio('assets/audio/pickupPowerup.wav'),
    pauseGameSound: new Audio('assets/audio/gamePause.wav'),
    menuHoverSound: new Audio('assets/audio/menuHover.wav'),
    backgroundMusic: new Audio('assets/audio/backgroundMusic.wav'),

    WINDOWHEIGHT: 800, //px
    WINDOWWIDTH: 800, //px
  }

  //Assign event listeners
  CACHE.webpage.addEventListener('keydown', (ev) => {
    //Prevent arrow keys from scrolling the window
    if(["Space"," ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(ev.code) > -1) {
      ev.preventDefault();
    }

    //Add key to keylog
    let keyPressed = ev.key;
    //Re-map wasd to arrow keys
    if (keyPressed === 'w') {keyPressed = 'ArrowUp'};
    if (keyPressed === 'a') {keyPressed = 'ArrowLeft'};
    if (keyPressed === 's') {keyPressed = 'ArrowDown'};
    if (keyPressed === 'd') {keyPressed = 'ArrowRight'};
  
    if ((keyPressed.includes('Arrow')) && !keyLog.includes(keyPressed)) {
      //Add pressed key to keylog
      keyLog.push(keyPressed);
    }

    //PRESS SPACEBAR
    if (keyPressed === ' ') {
      if (GAME.end) {
        //Game is over - reset game
        init();
        CACHE.pauseGameSound.play();
      } else if (GAME.starting) {
        //Game is reset - start game
        startGame();
      } else if (!GAME.paused) {
        //Game has started - pause/pause
        useSpeedBoost();
      }
    }

    if (keyPressed === 'q') {
      if (!GAME.end && !GAME.starting) {
        pauseGame();
      }
    }
  });
  
  CACHE.webpage.addEventListener('keyup', (ev) => {
    ev.preventDefault();
    //remove key from keylog
    let keyPressed = ev.key;
    //Re-map wasd to arrow keys
    if (keyPressed === 'w') {keyPressed = 'ArrowUp'};
    if (keyPressed === 'a') {keyPressed = 'ArrowLeft'};
    if (keyPressed === 's') {keyPressed = 'ArrowDown'};
    if (keyPressed === 'd') {keyPressed = 'ArrowRight'};
  
    if (keyLog.includes(keyPressed)) {
      //Remove pressed key from keylog
      keyLog = keyLog.filter(x=>{return x != keyPressed});
    }
  });

  //Audio on repeat and volume adjustments
  CACHE.backgroundMusic.volume = 0.4;
  CACHE.backgroundMusic.loop = true; 
  CACHE.gameLoseMusic.volume = 0.6;
  CACHE.gameLoseMusic.loop = true;
  CACHE.gameWinMusic.volume = 0.8;
  CACHE.gameWinMusic.loop = true;

}

function resetGamestate() {
  enemyBlobs.forEach(b=>{
    b.delete();
  })

  GAME = {
    starting: true,
    end: false,
    winSize: CACHE.WINDOWWIDTH/8,
    paused: true,
    musicMuted: false,
    soundMuted: false,
    blobsEaten: 0, //nom nom
    timeElapsed: 0, //seconds

    MAXENEMYBLOBS: 16, //on screen at any one time
    enemySpawnChance: FPS * 3, //spance, per frame: 1 in ...
    spawnChanceReduction: 0.99 ** (1/FPS), //amount the chance above changes by each frame (based on 1% per second)
    specialSpawnChance: 16, //1/16 chance of a blob spawning with special properties
    specialChanceReduction: 0.99 ** (1/FPS), //amount the chance above changes by each frame (based on 1% per second)
    spawnCounter: 0,
    spawnThreshold: 1000,
    bossWaves: [0, 0, 0, 0, 0],
  }

  PLAYER = new Blob(); //player data obj at top, left coordinates
  enemyBlobs = []; //array of enemy objects
  keyLog = []; //array of arrow keys currently pressed
}

function initialisePlayer() {
  //Position player next to arrow in the startup screen
  let pTextTop = CACHE.yourBlobText.offsetTop;
  let pTextLeft = CACHE.yourBlobText.offsetLeft;
  let pTextHeight = CACHE.yourBlobText.offsetHeight;
  let pTextWidth = CACHE.yourBlobText.offsetWidth;

  PLAYER.top = pTextTop + pTextHeight/2 - PLAYER.size/2;
  PLAYER.left = pTextLeft + pTextWidth/2;

  PLAYER.maxSpeed = 100/FPS; //100px/s, converted into px/frame
  PLAYER.maxSpeedBase = PLAYER.maxSpeed;
  PLAYER.speed = 0; //current speed
  PLAYER.direction = null; //direction player is moving in - angle from horizontal (+x)
  // PLAYER.maxTurning = 8*Math.PI/FPS; //two full circles per second
  PLAYER.size = 10; //player diameter in pixels
  PLAYER.type = 'normal';
  PLAYER.color = 'darkgrey';
  PLAYER.decayRate = 0.997**(1/FPS) //0.2% per second

  PLAYER.speedBoostActive = false;
  PLAYER.speedBoostAmount = 1.5; //player moves 50% faster while speed boost is active
  PLAYER.speedBoostDuration = 2 * FPS; //2s duration
  PLAYER.speedBoostCooldown = 10 * FPS + PLAYER.speedBoostDuration; //12s cooldown from use
  PLAYER.speedBoostTimer = 0;
  PLAYER.speedBoostCooldownTimer = 0;
}

function useSpeedBoost() {
  if (!PLAYER.speedBoostActive && PLAYER.speedBoostCooldownTimer < 1) {
    PLAYER.speedBoostActive = true;
    PLAYER.speedBoostTimer = PLAYER.speedBoostDuration;
    PLAYER.speedBoostCooldownTimer = PLAYER.speedBoostCooldown;
  } else {
    PLAYER.speedBoostActive = false;
  }
}

function checkSpeedBoost() {
  //check speedboost cooldown
  if (PLAYER.speedBoostTimer > 0) {
    PLAYER.speedBoostTimer -= 1
    if (PLAYER.speedBoostTimer === 0) {
      PLAYER.speedBoostActive = false;
    }
  }
  
  if (PLAYER.speedBoostCooldownTimer > 0) {
    PLAYER.speedBoostCooldownTimer -= 1;
    CACHE.speedBoostInfo.innerText = `Speed Boost Unavailable: ${Math.ceil(PLAYER.speedBoostCooldownTimer/FPS*10)/10}s remaining`;
    if (PLAYER.speedBoostCooldownTimer === 0) {
      CACHE.speedBoostInfo.innerText = 'Speed Boost Available. Press spacebar to activate.';
    }
  }
}

function applySpeedBoost() {
  if (PLAYER.speedBoostActive) {
    PLAYER.maxSpeed = PLAYER.maxSpeedBase * PLAYER.speedBoostAmount;
    CACHE.speedBoostInfo.innerText = `Speed Boost Active: ${Math.ceil(PLAYER.speedBoostTimer/FPS*10)/10}s remaining`;
  } else {
    PLAYER.maxSpeed = PLAYER.maxSpeedBase;
  }
}

function loadUI() {
  CACHE.gameWindow.style.height = CACHE.WINDOWHEIGHT + 'px';
  CACHE.gameWindow.style.width = CACHE.WINDOWWIDTH + 'px';

  CACHE.gameOverWindow.style.display = 'none';
  CACHE.startupWindow.style.display = 'flex';
  CACHE.startupWindow.style.opacity = '1';

  CACHE.hintText.innerText = `Hint: ${getRandomHint()}`;
  CACHE.winSizeText.innerText = `Your blob decays over time.\nReach a size of ${Math.round(GAME.winSize*100)/100}px to win.`
  CACHE.speedBoostInfo.innerText = 'Speed Boost Available. Press spacebar to activate.';
  CACHE.speedBoostInfoContainer.style.display = 'none';
}

function getRandomHint() {
  let hints = [
    //Game tips
    'Did you know that you can pause the game with spacebar?',
    'Did you know that you can pause the game by clicking on the timer in the menubar?',
    'The "Mute" button mutes all audio and sound effects in the game.',
    'Don\'t linger close to the edges, a large blob might suddenly surprise you!',
    'Radioactive blobs glow, change colours and make you smaller!',
    'Radioactive blobs and their waste decay over time.',
    'Hawks are brown and circle around you before striking!',
    'Hawks ignore you if you are bigger than them.',
    'Once a Hawk has begun lunging at you it cannot change direction.',
    'Meteors are yellow and make you smaller if they hit you.',
    'Meteors might be fast but they are not always great at turning.',
    'Meteors slingshot around you for another go if they miss.',
    'Trackers are red and hunt you relentlessly if they are bigger than you.',
    'Trackers that are smaller than you flee if you get too close.',
    'Have you tried tricking a Tracker into going off the screen?',
    'Angelic blobs are pale white and grant three times the size increase.',
    'Speeders are orange and tend to travel really, really fast!!',
    'Growers are teal and increase in size every second.',
    'Jumbo blobs are grey and are big and veeerrrryyyy slow.',
    'The chance for a blob to spawn increases with time.',
    'The chance for a special blob to spawn increases with time.',
    'Consuming a special blob will usually grant additional size growth.',
    'There is a 1/512 base chance that any spawned blob will be radioactive.',
    'There can only ever be a maximum of 16 blobs on the screen at a time.',
    'The bigger you get, the bigger the blobs will get!',
    'Have you tried outrunning a blob by moving diagonally?',
    'This game is not optimised for small devices!!',
    'No blobs were harmed in the making of this game.',

    //Unimplemented features
    // 'Not everything written in these hints has been implemented just yet...',
    // 'Normal blobs have a chance to merge if they collide.',
    // 'If radioactive waste hits another blob, it too will become radioactive!',
    // 'Imagine if blobs could mutate?',
    // 'Imagine if your blob decayed over time?',
    // 'Imagine if this game had a hard mode?',
    // 'Imagine if this game had a leaderboard?',
    // 'The Speed powerup makes you twice as fast for 10 seconds.',
    // 'The Invicibility powerup makes you invincible for 5 seconds.',
    // 'The Invisibility powerup stops you from being tracked for 10 seconds.',
    // 'The Teleport powerup lets you jump across the screen in a given direction.',
    // 'The "Blobs Eaten" menu button will show you stats on what you\'ve consumed.',
    // 'The "Size" menu button will show you a graph of your size throughout the game.',
    // 'The "Help" menu button will give you information on the different types of blobs.',

    //New Blobs?
    //Ink blobs leave leave a decaying trail which slows the player when passed over.
    //Rainbow blobs will burst when eaten!
    //Leeches consume other blobs to get bigger as they pursue you!
    //Toxic blobs leave a decaying pool of acid that reduces your size if you cross over it.
    //Heart blobs grant a random powerup when eaten.
  ]

  return hints[Math.floor(Math.random() * hints.length)];
}

function startGame() {
  //remove the startup UI
  fadeOutEffect(CACHE.startupWindow);
  GAME.starting = false;
  CACHE.speedBoostInfoContainer.style.display = 'flex';

  //play some beats!
  CACHE.gameLoseMusic.pause();
  CACHE.gameWinMusic.pause();
  CACHE.backgroundMusic.currentTime = 0;
  CACHE.backgroundMusic.play();

  pauseGame(); //unpauses the game and starts
}

/*MAIN GAME ENGINE & CONTROL */
function gameEngine() {
  //Main game functions and calculations

  //Compute time elapsed
  GAME.timeElapsed += 1/FPS; //seconds
  if (!CACHE.backgroundMusic.paused) {
    CACHE.backgroundMusic.play();
  }

  //Spawn enemy blobs at random
  if (enemyBlobs.length < GAME.MAXENEMYBLOBS) {
    let spawnRoll = Math.floor(Math.random() * GAME.enemySpawnChance);
    if (spawnRoll < 1) {
      enemyBlobs.push(new Blob);
      CACHE.blobSpawnSound.play();
    } else {
      //catch leftover from spawn roll and add up - when reaches a set value (1000, then 2000, then 3000 etc?) spawn a blob (or barrage?) - to stop long periods of time with no spawning
      GAME.spawnCounter += spawnRoll - 1;
      if (GAME.spawnCounter > GAME.spawnThreshold) {
        enemyBlobs.push(new Blob);
        CACHE.blobSpawnSound.play();
        GAME.spawnThreshold += GAME.spawnThreshold;
        //perhaps spawn different blobs/bosses at each threshold?
      }
    }
  }

  //"Boss" spawns
  checkBossWaves();

  //Compute new chances of spawning blobs as time progresses
  GAME.enemySpawnChance *= GAME.spawnChanceReduction;
  GAME.enemySpawnChance = Math.max(GAME.enemySpawnChance, 1/3 * FPS); //bottoms out at 3 spawns per second

  GAME.specialSpawnChance *= GAME.specialChanceReduction;
  GAME.specialSpawnChance = Math.max(GAME.specialSpawnChance, 3); //bottoms out at 1 spawn every 3 blobs

  checkSpeedBoost();
  applySpeedBoost();
  movePlayer();

  enemyBlobs.forEach(b=>{
    b.move();
  });

  for (blob of enemyBlobs) {
    if (blob.type === "radioactive") {
      if (Math.floor(Math.random() * FPS/4 < 1)) {
        //Spawn four particles on average every second
        let newBlob = new Blob;
        newBlob.type = 'normal';
        newBlob.aggressive = false;
        newBlob.decayRate = 0.75 ** (1/FPS); //decay by 25% per s
        newBlob.direction = Math.random() * 180 / Math.PI;
        newBlob.speed *= 2;
        newBlob.size = blob.size * (0.5 + 0.5 * pseudoGaussianDistribution());
        newBlob.left = blob.left+(blob.size-newBlob.size)/2;
        newBlob.top = blob.top+(blob.size-newBlob.size)/2;
        newBlob.reward = -1; //radioactive blobs are bad!
        newBlob.obj.style.backgroundColor = '#aaff55';
        newBlob.obj.style.boxShadow = '0px 0px 10px red';

        enemyBlobs.push(newBlob);
      }
    } 
  }

  for (blob of enemyBlobs) {
    blob.size *= blob.decayRate;
    if (blob.size < 5) { 
      //when blob is too small, delete it
      blob.delete();
    }
  }

  enemyBlobs.forEach(b=>{
    checkCollisions(b);
  });

  PLAYER.size *= PLAYER.decayRate; 
  if (PLAYER.size <= 5) {
    loseGame(PLAYER);
  } else {
    PLAYER.size = Math.max(PLAYER.size,5);
  }

  
  //check win
  if (PLAYER.size > GAME.winSize) {
    winGame();
  }

  //Display gamestate to UI
  render();
}

/*GAME HELPER FUNCTIONS*/
function movePlayer() {
  let currentDir = PLAYER.direction;
  let directionX = 0;
  let directionY = 0;
  //Resolve keylog
  for (key of keyLog) {
    switch (key) {
      case 'ArrowUp': //UP
        directionY -= 1;
        break;
      case 'ArrowLeft': //LEFT
        directionX -= 1;
        break;
      case 'ArrowDown': //DOWN
        directionY += 1;
        break;
      case 'ArrowRight': //RIGHT  
        directionX += 1;
      break;
    }
  }
  //compute direction angle
  let newDir = Math.atan(directionY/directionX);
  if (directionX < 0) {
    newDir += Math.PI;
  }
  //determine if not moving
  if (directionX === 0 && directionY === 0) {
    PLAYER.direction = null;
    PLAYER.speed = 0;
  } else {
    //move play in direction of angle - could do acceleration in future
    PLAYER.speed = PLAYER.maxSpeed;
    if (PLAYER.direction === null) {
      //moving from stopped
      PLAYER.direction = newDir;
    } else {
      // PLAYER.direction = computeTurningCircle(currentDir,newDir,PLAYER.maxTurning);
      PLAYER.direction = newDir;
    }
  }
  //limit to borders of the game window
  PLAYER.top = Math.max(Math.min(
    PLAYER.top + Math.sin(PLAYER.direction) * PLAYER.speed,
    CACHE.WINDOWHEIGHT-PLAYER.size),0);

  PLAYER.left = Math.max(Math.min(
    PLAYER.left + Math.cos(PLAYER.direction) * PLAYER.speed,
    CACHE.WINDOWWIDTH-PLAYER.size),0);
}

function checkCollisions(blob) {
  /*collision occurs when the two circles overlap; 
  i.e. when the shortest distance between the centre of the player and the blob is less than the radius of the two circles added together.*/

  let dx = (PLAYER.left + PLAYER.size/2) - (blob.left + blob.size/2);
  let dy = (PLAYER.top + PLAYER.size/2) - (blob.top + blob.size/2);

  if (Math.sqrt(dx**2 + dy**2) < (PLAYER.size + blob.size)/2) {
    //Collision!
    if (PLAYER.size > blob.size) { 
      //player is bigger than blob
      GAME.blobsEaten += 1;
      CACHE.blobEatingSound.play();

      //consume blob by adding a quarter of its total area to the player's blob area
      let pArea = PLAYER.size ** 2 * Math.PI/4;
      let bArea = blob.size ** 2 * Math.PI/4;
      pArea += bArea/4 * blob.reward;

      let sizeBefore = PLAYER.size;
      PLAYER.size = Math.max(Math.sqrt(pArea * 4 / Math.PI),5); //to 2 decimal places, no smaller than 5px
      
      //re-adjust player location so size increases from the centre
      PLAYER.left -= (PLAYER.size - sizeBefore)/2;
      PLAYER.top -= (PLAYER.size - sizeBefore)/2;

      //delete the consumed blob
      blob.delete();

    } else { 
      //blob is bigger than the player
      loseGame(blob); //You lose!
    }
  }
}

function computeTurningCircle(currentAngle,proposedAngle,maxTurningCircle) {
  //Computes whether the blob is turning left, right, or straight, and limits the maximum amount it can change direction by the turning circle.
  //WARNING: Heavy trigonometry at play in this function; the mathematics were worked-out on paper.
  
  //ALL ANGLES ARE IN RADIANS (360 degrees = 2PI radians)

  //Shift all angles to be within one full revolution (0->2PI) for reasonable comparison to each other
  while (currentAngle > 2*Math.PI) {
    currentAngle -= 2*Math.PI;
  }
  while (currentAngle < 0) {
    currentAngle += 2*Math.PI;
  }
  while (proposedAngle > 2*Math.PI) {
    proposedAngle -= 2*Math.PI;
  }
  while (proposedAngle < 0) {
    proposedAngle += 2*Math.PI;
  }

  let dA = currentAngle - proposedAngle; //difference in blob's current trajectory and the trajectory it wants to be on

  //Determine what direction the blob wants to turn
  if (((dA > 0) && (dA < Math.PI)) || ((dA > -2 * Math.PI) && (dA < -Math.PI))) {
    //is turning LEFT
    if ((proposedAngle > currentAngle - maxTurningCircle) && (proposedAngle < currentAngle)) {
      //If the proposed angle is within the turning circle, return it
      return proposedAngle;
    } else { 
      //otherwise, max out the rotation at the turning circle limit
      return currentAngle - maxTurningCircle;
    }
    
  } else if (((dA > Math.PI) && (dA < 2 * Math.PI)) || ((dA > -Math.PI) && (dA < 0))) {
    //is turning RIGHT
    if ((proposedAngle > currentAngle) && (proposedAngle < currentAngle + maxTurningCircle)) {
      //If the proposed angle is within the turning circle, return it
      return proposedAngle;
    } else {
      //otherwise, max out the rotation at the turning circle limit
      return currentAngle + maxTurningCircle;
    }
    
  } else if (Math.abs(dA) === Math.PI) {
    //is heading in a straight line away from the player
    //randomly choose to begin turning left or right
    return currentAngle + (Math.abs(Math.random() - 0.5)) * maxTurningCircle;
      
  } else { //dA === 0
    //is already on target trajectory: Do nothing, maintain current path
    return currentAngle;
  }
}

function checkBossWaves() {
  let spawnChanceTmp = GAME.specialSpawnChance;
  GAME.specialSpawnChance = 1;
  if (PLAYER.size > 20 && GAME.bossWaves[0] < 3) {
    //Wave 1: 20px - 3 special blobs
    GAME.bossWaves[0] += 1; //could do +1/FPS and spawn ever 0.5s or something
    enemyBlobs.push(new Blob);
    CACHE.blobSpawnSound.play();
  } else if (PLAYER.size > 40 && GAME.bossWaves[1] < 5) {
    //Wave 2: 40px - 5 special blobs
    GAME.bossWaves[1] += 1;
    enemyBlobs.push(new Blob);
    CACHE.blobSpawnSound.play();
  } else if (PLAYER.size > 80 && GAME.bossWaves[2] < 7) {
    //Wave 2: 40px - 5 special blobs
    GAME.bossWaves[2] += 1;
    enemyBlobs.push(new Blob);
    CACHE.blobSpawnSound.play();
  } else if (PLAYER.size > 160 && GAME.bossWaves[3] < 9) {
    //Wave 2: 40px - 5 special blobs
    GAME.bossWaves[3] += 1;
    enemyBlobs.push(new Blob);
    CACHE.blobSpawnSound.play();
  }
  GAME.specialSpawnChance = spawnChanceTmp;
}

function loseGame(blob) {
  stopClock();
  CACHE.backgroundMusic.pause();
  CACHE.gameLoseSound.play();
  CACHE.gameLoseMusic.currentTime = 0;
  CACHE.gameLoseMusic.play();
  GAME.end = true;
  CACHE.gameOverWindow.style.display = 'flex';
  CACHE.resultsText.innerText = `YOU LOSE\nTime survived: ${Math.floor(GAME.timeElapsed * 10)/10}s\nYour size: ${Math.floor(PLAYER.size * 100)/100}\nBlob size: ${Math.floor(blob.size*100)/100}`;
}

function winGame() {
  stopClock();
  CACHE.backgroundMusic.pause();
  CACHE.gameWinMusic.currentTime = 0;
  CACHE.gameWinMusic.play();
  GAME.end = true;
  CACHE.gameClock.innerText = `RESTART`;
  CACHE.gameOverWindow.style.display = 'flex';
  CACHE.resultsText.innerText = `YOU WIN!\nBlobs eaten: ${GAME.blobsEaten}\nTime taken: ${Math.floor(GAME.timeElapsed * 10)/10}s`;
}

/*TOOLBOOX*/
function pseudoGaussianDistribution() {
  //It's a simple, but fake bell curve from -1 to +1
  return ((Math.random() + Math.random() + Math.random())/3 - 0.5) * 2;
}

/*USER INTERFACE*/
function render() {
  //PLAYER SIZE
  CACHE.player.style.width = `${PLAYER.size}px`;
  CACHE.player.style.height = `${PLAYER.size}px`;
  CACHE.player.style.borderRadius = `${PLAYER.size/2}px`;
  //PLAYER POSITION
  CACHE.player.style.top = `${PLAYER.top}px`;
  CACHE.player.style.left = `${PLAYER.left}px`;

  //BLOBS
  for (blob of enemyBlobs) {
    blob.obj.style.width = `${blob.size}px`;
    blob.obj.style.height = `${blob.size}px`;
    blob.obj.style.borderRadius = `${blob.size/2}px`;
    //BLOB POSITION
    blob.obj.style.top = `${blob.top}px`;
    blob.obj.style.left = `${blob.left}px`;

    if (blob.type === "radioactive") {
      //changes colour all the time
      let randomColour = Math.floor(Math.random()*16777215).toString(16);
      blob.obj.style.backgroundColor = '#' + randomColour;
    }
  }

  //HEADER
  CACHE.blobsEaten.innerText = `Blobs eaten: ${GAME.blobsEaten}`;
  CACHE.playerSize.innerText = `Size: ${Math.floor(PLAYER.size * 100)/100}px`;

  displayClock(); //Don't update the clock if the game has ended because it must read "RESTART"
  
}

function displayClock() {
  if (!GAME.end) {
    CACHE.gameClock.innerText = `${Math.floor(GAME.timeElapsed * 10)/10}s`;  
  } else {
    CACHE.gameClock.innerText = `RESTART`;
  }
}

/*USER INTERACTION*/
function clickTracker(ev) {
  if ((ev.target.id === "startupWindow") || (ev.target.id === "gameOverWindow") || (ev.target.parentNode.id === "startupWindow") || (ev.target.parentNode.id === "gameOverWindow")) {
    if (GAME.end) {
      //Game is over - reset game
      init();
      CACHE.pauseGameSound.play();
    } else if (GAME.starting) {
      //Start game
      startGame(); //remove startup text
    }
  } else if (ev.target.id === "gameClock") {
    if (GAME.end) {
      //Reset game
      init();
    } else if (!GAME.starting) {
      //pause game
      pauseGame();
    }
  } else if (ev.target.id === "muteSound") {
    muteSFX();
  } else if (ev.target.id === "muteMusic") {
    muteMusic();
  }
}

function muteMusic() {
  GAME.musicMuted = !GAME.musicMuted;

  if (GAME.musicMuted) {
    //MUTE ALL MUSIC
    // CACHE.muteMBtn.innerText = 'Unmute M';
    // CACHE.muteMBtn.style.color = 'firebrick';
    // CACHE.muteMBtn.style.border = '3px solid firebrick';
    CACHE.muteMBtn.style.backgroundImage = 'url(assets/ui/music-muted-white.png)';

    CACHE.gameWinMusic.muted = true;
    CACHE.gameLoseMusic.muted = true;
    CACHE.backgroundMusic.muted = true;
  } else {
    //UNMUTE ALL MUSIC
    // CACHE.muteMBtn.innerText = 'Mute M';
    // CACHE.muteMBtn.style.color = 'white';
    // CACHE.muteMBtn.style.border = '0px solid firebrick';
    CACHE.muteMBtn.style.backgroundImage = 'url(assets/ui/music-unmuted-white.png)';

    CACHE.gameWinMusic.muted = false;
    CACHE.gameLoseMusic.muted = false;
    CACHE.backgroundMusic.muted = false;
  }
}

function muteSFX() {
  GAME.soundMuted = !GAME.soundMuted;

  if (GAME.soundMuted) {
    //MUTE ALL SOUNDEFFECTS
    // CACHE.muteSBtn.innerText = 'Unmute S';
    // CACHE.muteSBtn.style.color = 'firebrick';
    // CACHE.muteSBtn.style.border = '3px solid firebrick';
    CACHE.muteSBtn.style.backgroundImage = 'url(assets/ui/sound-muted-white.png)';

    CACHE.gameLoseSound.muted = true;
    CACHE.blobSpawnSound.muted = true;
    CACHE.blobEatingSound.muted = true;
    CACHE.pickupPowerupSound.muted = true;
    CACHE.pauseGameSound.muted = true;
    CACHE.menuHoverSound.muted = true;
  } else {
    //UNMUTE ALL SOUNDEFFECTS
    // CACHE.muteSBtn.innerText = 'Mute S';
    // CACHE.muteSBtn.style.color = 'white';
    // CACHE.muteSBtn.style.border = '0px solid firebrick';
    CACHE.muteSBtn.style.backgroundImage = 'url(assets/ui/sound-unmuted-white.png)';

    CACHE.gameLoseSound.muted = false;
    CACHE.blobSpawnSound.muted = false;
    CACHE.blobEatingSound.muted = false;
    CACHE.pickupPowerupSound.muted = false;
    CACHE.pauseGameSound.muted = false;
    CACHE.menuHoverSound.muted = false;
  }
}

function pauseGame() {
  GAME.paused = !GAME.paused;
  CACHE.pauseGameSound.play();
  if (GAME.paused) {
    stopClock();
    CACHE.pauseText.style.display = 'flex';
  } else {
    startClock();
    CACHE.pauseText.style.display = 'none';
  }
  displayClock();
}

function startClock() {
  CACHE.gameTicker = setInterval(()=>gameEngine(),1000/FPS); //start the game engine
}

function stopClock() {
  clearInterval(CACHE.gameTicker); //stop the game engine
}




/*FUN GIMMICKS*/
function fadeOutEffect(target) {
  let fadeEffect = setInterval(function () {
      if (!target.style.opacity) {
        target.style.opacity = 1;
      }
      if (target.style.opacity > 0) {
        target.style.opacity -= 0.05;
      } else {
        target.style.display = 'none';
        clearInterval(fadeEffect);
      }
  }, 200);
}

//LETS GO!
main();