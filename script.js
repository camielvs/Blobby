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
const MAX_ENEMY_BLOBS = 16; //on screen at any one time
let CACHE = {};
let PLAYER = null; //player data obj at top, left coordinates
let GAME = {};
let enemyBlobs = []; //array of enemy objects
let keyLog = []; //array of arrow keys currently pressed

class Blob {
  constructor() {
    this.obj = document.createElement('div');

    this.speed = (Math.random() * 150 + 50)/FPS; //pixels per frame - from 50 to 200 pixels per second (player is 100)
    this.size = 10;
    if (PLAYER) {
      this.size = Math.floor((PLAYER.size * (pseudoGaussianDistribution() * 0.5 + 1))*1000)/1000; //pixels diameter scales with player size
    }
    this.isDecaying = false;
    //blob spawn location - spawning is done radially in a circle around the center of the game window and the blob is given a direction that is roughly toward the centre 
    //FANCY MATHEMATICS/TRIGONOMETRY BELOW - TRUST ME, I WORKED IT OUT ON A PIECE OF PAPER.
    let angle = Math.random() * 2 * Math.PI; //spawn angle radians
    this.left = CACHE.WINDOWWIDTH/2 * ( 1 + Math.max(Math.min(Math.sqrt(2) * Math.cos(angle), 1), -1)); //spawns on edge of window
    if (this.left < 1) { //adjust to spawn just outside the border
      this.left -= this.size;
    }
    this.top = CACHE.WINDOWHEIGHT/2 * ( 1 + Math.max(Math.min(Math.sqrt(2) * Math.sin(angle), 1), -1)); //spawns on edge of window
    if (this.top < 1) { //adjust to spawn just outside the border
      this.top -= this.size;
    }
    this.direction = angle + Math.PI - Math.PI/8 + Math.random() * Math.PI/8; //angle (measured from 0 radians = vertical->down) that the blob is travelling in
    this.hasEnteredWindow = false;

    this.id = 'b' + (Math.random() + this.speed + this.size + this.direction); //random pseudo random number lol

    if (Math.floor(Math.random() * GAME.specialSpawnChance) < 1) {
      //SPECIAL BLOB
      this.reward = 2; //specials are worth double!
       
      let randRoll = Math.floor(Math.random() * 16);
      if (Math.floor(Math.random() * 2) < 1) {
        //agressive
        this.aggressive = true; //will track the player
        // console.log('Spawning angry blob');
        if (randRoll < 1) {
          this.type = 'radioactive'; //spawns blobs around it, which decay
          this.color = 'black'; //will be random
          this.isDecaying = true;
          this.reward = -2;
          this.obj.style.boxShadow = '0px 0px 10px lime';
        } else if (randRoll < 5) {
          this.type = 'flaming'; //burns the player to make them smaller!
          this.color = '#ffff55'; //orange-red
          this.speed = Math.min(this.speed * 1.5, 10); //max speed 10
          this.reward = -1; //it takes away from you!
          this.size *= 0.8; //20% smaller
        } else if (randRoll < 9) {
          this.type = 'hawk'; //circles the player - lunges in when close!
          this.color = '#aaaa55'; //gross greeny-gold
          // this.speed_base = this.speed;
          // this.size = Math.min(this.size, 20);
          // this.isLunging = false;
        } else {
          this.type = 'tracker'; //tracks the player as opposed to going in a straight line
          this.color = '#ff5555'; //some kind of red it seems
          this.speed = Math.min(this.speed, 4); //trackers can never be faster than 4px/frame
          // this.size = Math.max(this.size * 2/3, 10); //slightly smaller
          this.size *= 1.2; //20% larger
        }
      } else {
        // console.log('Spawning friendly blob');
        //passive
        this.aggressive = false; //will not track the player
        if (randRoll < 1) {
          this.type = 'angelic'; //bonus xp
          this.color = '#d4d4d4'; //creamy white
          this.reward = 3; //even more exp for these!
        } else if (randRoll < 6) {
          this.type = 'speeder'; //goes really fast!
          this.color = '#ffaa55'; //orangey
          this.speed = Math.max(this.speed * 2, 4); //min speed 4px/frame
          this.size = Math.max(this.size / 2, 5); //min 5px size
        } else if (randRoll < 11) {
          this.type = 'grower'; //gets bigger over time
          this.color = '#55ffff'; //teal-ish
        } else {
          this.type = 'jumbo'; //big and slow
          this.color = '#555555'; //grey
          this.size *= 2;
          this.speed = (Math.random() * 60 + 15)/FPS; //speed 0.5 - 2.5
        }
      }   
    } else {
      this.type = 'normal';
      this.reward = 1;
      this.aggressive = false;
      this.color = '#aaff55';
    }

    this.obj.classList.add('blob');
    this.obj.style.backgroundColor = this.color;
    this.obj.id = this.id;
    CACHE.blobWindow.appendChild(this.obj);
    // console.log('blob spawned')

  }
  delete() {
    let newArr = enemyBlobs.filter(x=>{
      return x.id != this.id;
    })
    enemyBlobs = newArr;
    let blobEl = document.getElementById(this.id);
    blobEl.remove();
    // console.log('blob deleted')
  }
  move() {
    if (this.aggressive && ((this.size > 0.9 * PLAYER.size) || (this.type === 'flaming'))) {
      //aggressive and almost larger (or flaming type): pursue the player
      let pXCent = PLAYER.left + PLAYER.size/2;
      let pYCent = PLAYER.top + PLAYER.size/2;
      let bXCent = this.left + this.size/2;
      let bYCent = this.top + this.size/2;

      let dx = pXCent - bXCent;
      let dy = pYCent - bYCent;

      let angle = Math.atan(dy/dx);

      if (dx < 0) { //stops the tracking blobs from bouncing away from the centreline axis of the player
        angle += Math.PI;
      }


      this.direction = angle;

    } else {
      //not aggressive, move in a straight line

    }

    this.left += this.speed * Math.cos(this.direction);
    this.top += this.speed * Math.sin(this.direction);


    //growers grow at +0.2% / frame
    if (this.type === 'grower') {
      this.size *= 1 + 0.1/FPS;
    }

    //Check if blob has entered the window
    if (!this.hasEnteredWindow) {
      if ((this.left > -this.size) || (this.left < CACHE.WINDOWWIDTH) || (this.top > -this.size) || (this.top < CACHE.WINDOWHEIGHT)) {
        this.hasEnteredWindow = true;
      }
    }

    //Despawn blob if left the game window
    if (this.hasEnteredWindow && ((this.left < -this.size) || (this.left > CACHE.WINDOWWIDTH) || (this.top < -this.size) || (this.top > CACHE.WINDOWHEIGHT))) {
      this.delete();
    }
  }
}

// class Player extends Blob {
  //to refactor all of the different blob types into subclasses
// }

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

    gameOverWindow: document.getElementById('gameOverWindow'),
    resultsText: document.getElementById('gameResults'),
    pauseText: document.getElementById('pauseWindow'),

    //HEADER
    blobsEaten: document.getElementById('bEaten'),
    playerSize: document.getElementById('pSize'),
    gameClock: document.getElementById('gameClock'),
    help: document.getElementById('help'),
    muteBtn: document.getElementById('mute'),


    //AUDIO
    gameWinMusic: new Audio('assets/gameWinMusic.wav'),
    gameLoseMusic: new Audio('assets/gameLoseMusic.mp3'),
    gameLoseSound: new Audio('assets/gameLoseSound.wav'),
    blobSpawnSound: new Audio('assets/blobSpawn.wav'),
    blobEatingSound: new Audio('assets/blobEaten.wav'),
    pickupPowerupSound: new Audio('assets/pickupPowerup.wav'),
    pauseGameSound: new Audio('assets/gamePause.wav'),
    menuHoverSound: new Audio('assets/menuHover.wav'),
    backgroundMusic: new Audio('assets/backgroundMusic.wav'),

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
      } else {
        //Game has started - pause/pause
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

  //Audio on repeat
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
    winSize: CACHE.WINDOWWIDTH/4,
    // winSize: 11, //for testing purposes
    paused: true,
    muted: false,
    blobsEaten: 0, //nom nom
    timeElapsed: 0, //seconds
    enemySpawnChance: FPS * 3, //spance, per frame: 1 in ...
    spawnChanceReduction: 0.99 ** (1/FPS), //amount the chance above changes by each frame (based on 1% per second)
    specialSpawnChance: 16, //1/16 chance of a blob spawning with special properties
    specialChanceReduction: 0.99 ** (1/FPS), //amount the chance above changes by each frame (based on 1% per second)
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

  PLAYER.speed = 100/FPS; //pixels per frame
  PLAYER.size = 10; //player diameter in pixels
  PLAYER.type = 'normal';
  PLAYER.color = 'darkgrey';
}

function loadUI() {
  CACHE.gameWindow.style.height = CACHE.WINDOWHEIGHT + 'px';
  CACHE.gameWindow.style.width = CACHE.WINDOWWIDTH + 'px';

  CACHE.gameOverWindow.style.display = 'none';
  CACHE.startupWindow.style.display = 'flex';
  CACHE.startupWindow.style.opacity = '1';

  CACHE.hintText.innerText = `Hint: ${getRandomHint()}`;



  
}

function getRandomHint() {
  let hints = [
    'Did you know that you can pause the game with spacebar?',
    'Did you know that you can pause the game by clicking on the timer in the header?',
    'Don\'t linger close to the edges, a large blob might suddenly surprise you!',
    'Radioactive blobs glow and change colours and will make you smaller!',
    'Radioactive blobs will spawn small blobs around them that decay over time.',
    'If radioactive waste hits another blob, it too will become radioactive!',
    'Hawks are brown and will circle around you before striking!',
    'Hawks will ignore you if you are bigger than them.',
    'Flaming blobs are yellow and will make you smaller if they reach you.',
    'Flaming blobs might be scary but they are not great at turning.',
    'Trackers are red and will hunt you relentlessly if they are bigger than you.',
    'Have you tried tricking a Tracker into going off the screen?',
    'Angelic blobs are pale white and grant three times the size increase.',
    'Speeders are orange and tend to travel really, really fast!!',
    'Growers are teal and increase in size the longer they are on the screen.',
    'Jumbo blobs are grey and are big and veeerrrryyyy slow.',
    'The chance for a blob to spawn increases with time.',
    'The chance for a special blob to spawn increases with time.',
    'At game start there is a 1/512 chance that any blob will be radioactive.',
    'There can only ever be a maximum of 16 blobs on the screen at a time',
    'The bigger you get, the bigger the blobs will get!',
    'Imagine if blobs could mutate?',
    'Imagine if your blob decayed over time?',
    'Imagine if this game had a hard mode?',
    'No blobs were harmed in the making of this game.',
    'Not everything written in these hints has been implemented just yet...',
    'This game is not optimised for small devices!!',

  ]

  return hints[Math.floor(Math.random() * hints.length)];
}

function startGame() {
  //remove the startup UI
  fadeOutEffect(CACHE.startupWindow);
  GAME.starting = false;

  //play some beats!
  CACHE.gameLoseMusic.pause();
  CACHE.gameWinMusic.pause();
  CACHE.backgroundMusic.currentTime = 0;
  CACHE.backgroundMusic.play();

  pauseGame(); //unpauses the game and starts
}

/*MAIN GAME ENGINE & CONTROL */
function gameEngine() {
  //Compute time elapsed
  GAME.timeElapsed += 1/FPS; //seconds
  if (!CACHE.backgroundMusic.paused) {
    CACHE.backgroundMusic.play();
  }


  //Spawn enemy blobs at random
  if (enemyBlobs.length < MAX_ENEMY_BLOBS) {
    if (Math.floor(Math.random() * GAME.enemySpawnChance < 1)) {
      enemyBlobs.push(new Blob);
      CACHE.blobSpawnSound.play();
    }
  }

  GAME.enemySpawnChance *= GAME.spawnChanceReduction;
  GAME.enemySpawnChance = Math.max(GAME.enemySpawnChance, 10); //bottoms out at 1 spawn every 10 frames

  GAME.specialSpawnChance *= GAME.specialChanceReduction;
  GAME.specialSpawnChance = Math.max(GAME.specialSpawnChance, 4); //bottoms out at 1 spawn every 4 frames

  for (key of keyLog) {
    movePlayer(key);
  }

  enemyBlobs.forEach(b=>{
    b.move();
  });

  for (blob of enemyBlobs) {
    if (blob.type === "radioactive") {
      if (Math.floor(Math.random() * 30 < 1)) {
        let newBlob = new Blob;
        newBlob.type = 'normal';
        newBlob.aggressive = false;
        newBlob.left = blob.left;
        newBlob.top = blob.top;
        newBlob.isDecaying = true;
        newBlob.direction = Math.random() * 180 / Math.PI;
        newBlob.speed *= 2;
        newBlob.size = blob.size * (0.5 + 0.5 * pseudoGaussianDistribution());
        newBlob.reward = -1; //radioactive blobs are bad!
        newBlob.obj.style.backgroundColor = '#aaff55';
        newBlob.obj.style.boxShadow = '0px 0px 10px #ccffcc';

        enemyBlobs.push(newBlob);
      }
    } 
  }

  for (blob of enemyBlobs) {
    if (blob.isDecaying)  {
      blob.size *= 0.99 //decays by 1% per frame
      if (blob.size < 5) { //when small, delete
        blob.delete();
      }
    }
  }

  enemyBlobs.forEach(b=>{
    checkCollisions(b);
  });
  
  //check win
  if (PLAYER.size > GAME.winSize) {
    winGame();
  }

  
  render();
}




/*GAME HELPER FUNCTIONS*/
function movePlayer(keyPressed) {
  switch (keyPressed) {
    case 'ArrowUp': //UP
      PLAYER.top = Math.max(PLAYER.top - PLAYER.speed,0);
    break;
    case 'ArrowLeft': //LEFT
      PLAYER.left = Math.max(PLAYER.left - PLAYER.speed,0);
    break;
    case 'ArrowDown': //DOWN
      PLAYER.top = Math.min(PLAYER.top + PLAYER.speed,Number(CACHE.gameWindow.style.height.split('px')[0])-PLAYER.size);
    break;
    case 'ArrowRight': //RIGHT
      PLAYER.left = Math.min(PLAYER.left + PLAYER.speed,Number(CACHE.gameWindow.style.width.split('px')[0])-PLAYER.size);
    break;
  }
}

function checkCollisions(blob) {
  /*collision occurs when the two circles overlaps; 
  i.e. when the shortest distance between the centre of the player and the blob is less than the radius of the two circles added together.
  */

  let dx = (PLAYER.left + PLAYER.size/2) - (blob.left + blob.size/2);
  let dy = (PLAYER.top + PLAYER.size/2) - (blob.top + blob.size/2);

  if (Math.sqrt(dx**2 + dy**2) < (PLAYER.size + blob.size)/2) {
    // console.log('Collision!');
    if (PLAYER.size > blob.size) { //player is bigger than blob
      GAME.blobsEaten += 1;
      CACHE.blobEatingSound.play();

      //consume blob by adding a quarter of its total area to the player's blob area
      let pArea = PLAYER.size ** 2 * Math.PI/4;
      let bArea = blob.size ** 2 * Math.PI/4;
      pArea += bArea/4 * blob.reward;

      let sizeBefore = PLAYER.size;
      PLAYER.size = Math.floor(Math.sqrt(pArea * 4 / Math.PI) * 100)/100; //to 2 decimal places
      
      //readjust player location so size increases from the centre
      PLAYER.left -= (PLAYER.size - sizeBefore)/2;
      PLAYER.top -= (PLAYER.size - sizeBefore)/2;

      //delete the consumed blob
      blob.delete();

    } else { //blob is bigger than the player
      //You lose!
      loseGame(blob);
    }
  }
}

function loseGame(blob) {
  stopClock();
  CACHE.backgroundMusic.pause();
  CACHE.gameLoseSound.play();
  CACHE.gameLoseMusic.currentTime = 0;
  CACHE.gameLoseMusic.play();
  GAME.end = true;
  CACHE.gameClock.innerText = `RESTART GAME`;
  CACHE.gameOverWindow.style.display = 'flex';
  CACHE.resultsText.innerText = `YOU LOSE\nTime survived: ${Math.floor(GAME.timeElapsed * 10)/10}s\nYour size: ${PLAYER.size}\nBlob size: ${Math.floor(blob.size*100)/100}`;
}

function winGame() {
  stopClock();
  CACHE.backgroundMusic.pause();
  CACHE.gameWinMusic.currentTime = 0;
  CACHE.gameWinMusic.play();
  GAME.end = true;
  CACHE.gameClock.innerText = `RESTART GAME`;
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

  // CACHE.player.style.innerHTML += `<img src='assets/blobby.png'></img>`;



  //BLOBS
  for (blob of enemyBlobs) {
    blob.obj.style.width = `${blob.size}px`;
    blob.obj.style.height = `${blob.size}px`;
    blob.obj.style.borderRadius = `${blob.size/2}px`;
    //PLAYER POSITION
    blob.obj.style.top = `${blob.top}px`;
    blob.obj.style.left = `${blob.left}px`;
  }


  //HEADER
  CACHE.blobsEaten.innerText = `Blobs eaten: ${GAME.blobsEaten}`;
  CACHE.playerSize.innerText = `Size: ${PLAYER.size}px`;

  if (!GAME.end) {
    displayClock();
  }


  for (blob of enemyBlobs) {
    if (blob.type === "radioactive") {
      //changes colour all the time
      let randomColor = Math.floor(Math.random()*16777215).toString(16);
      blob.obj.style.backgroundColor = '#' + randomColor;
    }
  }
}

function displayClock() {
  CACHE.gameClock.innerText = `${Math.floor(GAME.timeElapsed * 10)/10}s`;
}

/*USER INTERACTION*/

function clickTracker(ev) {
  // console.log('you clicked: '+ev.target.nodeName);
  if (ev.target.nodeName === "H1") {
    // console.log('heading!');
  } else if ((ev.target.id === "startupWindow") || (ev.target.id === "gameOverWindow") || (ev.target.parentNode.id === "startupWindow") || (ev.target.parentNode.id === "gameOverWindow")) {
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
  } else if (ev.target.id === "help") {
    //BESTAIRY functionality to be added, so players can look up info on the different blob types
    //SETTINGS functionality to be added, so players can change game parameters, log highscores, or restart
    if (!GAME.starting) {
      //pause game
      pauseGame();
    }
  } else if (ev.target.id === "mute") {
    muteSFX();
  }
}

function muteSFX() {
  GAME.muted = !GAME.muted;

  if (GAME.muted) {
    //MUTE ALL AUDIO
    CACHE.muteBtn.innerText = 'Unmute';
    CACHE.muteBtn.style.color = 'firebrick';
    CACHE.muteBtn.style.border = '3px solid firebrick';

    CACHE.gameWinMusic.muted = true;
    CACHE.gameLoseMusic.muted = true;
    CACHE.gameLoseSound.muted = true;
    CACHE.blobSpawnSound.muted = true;
    CACHE.blobEatingSound.muted = true;
    CACHE.pickupPowerupSound.muted = true;
    CACHE.pauseGameSound.muted = true;
    CACHE.menuHoverSound.muted = true;
    CACHE.backgroundMusic.muted = true;
  } else {
    //UNMUTE ALL AUDIO
    CACHE.muteBtn.innerText = 'Mute';
    CACHE.muteBtn.style.color = 'white';
    CACHE.muteBtn.style.border = '0px solid firebrick';

    CACHE.gameWinMusic.muted = false;
    CACHE.gameLoseMusic.muted = false;
    CACHE.gameLoseSound.muted = false;
    CACHE.blobSpawnSound.muted = false;
    CACHE.blobEatingSound.muted = false;
    CACHE.pickupPowerupSound.muted = false;
    CACHE.pauseGameSound.muted = false;
    CACHE.menuHoverSound.muted = false;
    CACHE.backgroundMusic.muted = false;
  }
}

function pauseGame() {
  GAME.paused = !GAME.paused;
  CACHE.pauseGameSound.play();
  if (GAME.paused) {
    // console.log('Pausing game')
    stopClock();
    CACHE.pauseText.style.display = 'flex';
  } else {
    // console.log('Unpausing game')
    startClock();
    CACHE.pauseText.style.display = 'none';
  }
  displayClock();
}

function startClock() {
  CACHE.gameTicker = setInterval(()=>gameEngine(),1000/FPS);
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