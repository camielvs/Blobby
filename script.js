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


function clickTracker(event) {
  console.log('you clicked!');
  if (event.target.nodeName === "H1") {
    console.log('heading!');
  } else if (event.target.id === "gameWindow") {
    console.log('Blobby game window');
  }
} 