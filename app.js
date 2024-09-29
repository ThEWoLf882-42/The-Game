import game from './game';

const homeContainer = document.querySelector('.home');
const settingsContainer = document.querySelector('.settings');
const usersProfileContainer = document.querySelector('.profile-pic-icon');

const keyState = new Set();
const KEY_UP = 'ArrowUp';
const KEY_DOWN = 'ArrowDown';
const KEY_W = 'w';
const KEY_S = 's';
const KEY_START = ' ';

window.addEventListener('keydown', e => {
	keyState.add(e.key);
	updateMovement();
});

window.addEventListener('keyup', e => {
	keyState.delete(e.key);
	updateMovement();
});

function updateMovement() {
	game.stopPlayerMovement();
	game.stopPlayer2Movement();

	if (keyState.has(KEY_START)) game.startBall();
	if (keyState.has(KEY_UP)) game.moveUp2();
	if (keyState.has(KEY_DOWN)) game.moveDown2();
	if (keyState.has(KEY_W)) game.moveUp();
	if (keyState.has(KEY_S)) game.moveDown();
}

homeContainer.addEventListener('click', e => {
	const btn = e.target.closest('.square2');
	if (btn) {
		const id = btn.dataset.id;
		game.switchHome(id);
	}
});

settingsContainer.addEventListener('click', e => {
	const btn = e.target.closest('.settings');
	if (btn) {
		game.toggleSBook();
	}
});

usersProfileContainer.addEventListener('click', e => {
	const btn = e.target.closest('.profile-pic-icon');
	if (btn) {
		game.toggleUsersProfile();
	}
});
