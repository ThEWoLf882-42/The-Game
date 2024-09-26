import * as THREE from 'three';
import { HOME, GAME, CHAT, LEADERBOARD } from './home';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import {
	CSS2DRenderer,
	CSS2DObject,
} from 'three/addons/renderers/CSS2DRenderer.js';

class Game {
	#camera;
	#scene;
	#renderer;
	#controls;
	#mixer;
	#font;
	#ttf;
	#css2DRenderer;
	#css2DObject;

	#ball;
	#player;
	#player2;
	#goalR;
	#goalL;
	#walls;
	#scoreLText;
	#scoreRText;
	#scoreL = 0;
	#scoreR = 0;

	#velocity = 30;
	#ballDirection = new THREE.Vector3();
	#minDir = 0.69;
	#playerDirection = 0;
	#player2Direction = 0;
	#hasChanges = false;

	#ballBox = new THREE.Box3();
	#playerBox = new THREE.Box3();
	#player2Box = new THREE.Box3();
	#goalRBox = new THREE.Box3();
	#goalLBox = new THREE.Box3();
	#wallsBoxes = [];

	#lastFrameTime = 0;
	#frameRate = 60;

	constructor() {
		this.#init();
	}

	#init() {
		this.#createScene();
		this.#createCamera();
		this.#createRenderer();
		this.#addDOMElem();
		this.#createControls();
		this.#loadEnvironment();
		this.#loadFont();
		window.addEventListener('resize', () => this.#onWindowResize());
		this.#animate();
	}

	#createScene() {
		this.#scene = new THREE.Scene();
	}

	#createCamera() {
		this.#camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.5,
			1000
		);
		this.#camera.position.set(0, 15, 10);
		this.#camera.lookAt(new THREE.Vector3(0, 0, 0));
	}

	#createRenderer() {
		this.#renderer = new THREE.WebGLRenderer({ antialias: true });
		this.#renderer.setPixelRatio(window.devicePixelRatio);
		this.#renderer.setSize(window.innerWidth, window.innerHeight);
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.#renderer.toneMappingExposure = 1;
		document.body.appendChild(this.#renderer.domElement);

		this.#css2DRenderer = new CSS2DRenderer();
		this.#css2DRenderer.setSize(window.innerWidth, window.innerHeight);
		this.#css2DRenderer.domElement.style.position = 'absolute';
		this.#css2DRenderer.domElement.style.top = '0';
		document.body.appendChild(this.#css2DRenderer.domElement);
	}

	#addDOMElem() {
		const homeContainer = document.createElement('div');
		homeContainer.className = 'home';
		homeContainer.innerHTML = HOME;

		this.#css2DObject = new CSS2DObject(homeContainer);
		this.#css2DObject.position.set(0, 10, 0);
		this.#scene.add(this.#css2DObject);
	}

	#createControls() {
		this.#controls = new OrbitControls(
			this.#camera,
			this.#renderer.domElement
		);
		this.#controls.addEventListener('change', () => this.#render());
		this.#controls.target.set(0, 0, 0);
		this.#controls.update();
	}

	#loadEnvironment() {
		new RGBELoader().setPath('textures/').load(
			'royal_esplanade_1k.hdr',
			texture => {
				texture.mapping = THREE.EquirectangularReflectionMapping;
				this.#scene.background = texture;
				this.#scene.environment = texture;
				this.#loadModelGLTF();
			},
			undefined,
			error => console.error('Error loading HDR texture:', error)
		);
	}

	#loadModelGLTF() {
		const loader = new GLTFLoader().setPath('models/');
		loader.load(
			'Game Play.gltf',
			async gltf => {
				const model = gltf.scene;
				await this.#renderer.compileAsync(
					model,
					this.#camera,
					this.#scene
				);
				this.#scene.add(model);
				this.#setObjects(model);

				this.#mixer = new THREE.AnimationMixer(model);
				gltf.animations.forEach(clip =>
					this.#mixer.clipAction(clip).play()
				);

				this.#render();
			},
			undefined,
			error => console.error('Error loading GLTF model:', error)
		);
	}

	#loadFont() {
		this.#ttf = new TTFLoader();

		this.#ttf.load('fonts/Gabriela-Regular.ttf', ttf => {
			this.#font = new FontLoader().parse(ttf);
		});
	}

	#onWindowResize() {
		this.#camera.aspect = window.innerWidth / window.innerHeight;
		this.#camera.updateProjectionMatrix();
		this.#renderer.setSize(window.innerWidth, window.innerHeight);
		this.#render();
	}

	#render() {
		this.#renderer.render(this.#scene, this.#camera);
	}

	#animate() {
		const now = performance.now();
		const delta = (now - this.#lastFrameTime) / 1000;
		if (now - this.#lastFrameTime > 1000 / this.#frameRate) {
			this.#lastFrameTime = now;
			this.#update();
			if (this.#mixer) this.#mixer.update(delta);
			if (this.#hasChanges) this.#render();
			this.#hasChanges = false;
		}
		requestAnimationFrame(() => this.#animate());
		this.#css2DRenderer.render(this.#scene, this.#camera);
		this.#renderer.render(this.#scene, this.#camera);
	}

	#update() {
		this.#hasChanges = false;

		if (this.#ball) {
			this.#ball.position.add(this.#ballDirection);
			this.#ballBox.setFromObject(this.#ball);
			this.#checkCollisions();
			this.#hasChanges = true;
		}

		if (this.#player) {
			this.#handelePlayerMovement(
				this.#player,
				this.#playerBox,
				this.#playerDirection,
				'Racket'
			);
		}

		if (this.#player2) {
			this.#handelePlayerMovement(
				this.#player2,
				this.#player2Box,
				this.#player2Direction,
				'Racket001'
			);
		}
	}

	#resetScore() {
		this.#scoreL = 0;
		this.#scoreR = 0;
		this.#updateScoreL('0');
		this.#updateScoreR('0');
	}

	#updateScoreL(newText) {
		if (this.#font && this.#scoreLText) {
			this.#scoreLText.geometry.dispose();

			const newTextGeometry = new TextGeometry(newText, {
				font: this.#font,
				size: 2,
				depth: 0,
			});
			newTextGeometry.computeBoundingBox();

			const boundingBox = newTextGeometry.boundingBox;
			const xOffset = (boundingBox.max.x - boundingBox.min.x) / 2;
			const yOffset = (boundingBox.max.y - boundingBox.min.y) / 2;

			newTextGeometry.translate(-xOffset, -yOffset, 0);

			this.#scoreLText.geometry = newTextGeometry;

			this.#scoreLText.rotation.set(0.296706, Math.PI, Math.PI);

			this.#hasChanges = true;
		}
	}

	#updateScoreR(newText) {
		if (this.#font && this.#scoreRText) {
			this.#scoreRText.geometry.dispose();

			const newTextGeometry = new TextGeometry(newText, {
				font: this.#font,
				size: 2,
				depth: 0,
			});
			newTextGeometry.computeBoundingBox();

			const boundingBox = newTextGeometry.boundingBox;
			const xOffset = (boundingBox.max.x - boundingBox.min.x) / 2;
			const yOffset = (boundingBox.max.y - boundingBox.min.y) / 2;

			newTextGeometry.translate(-xOffset, -yOffset, 0);

			this.#scoreRText.geometry = newTextGeometry;

			this.#scoreRText.rotation.set(0.296706, Math.PI, Math.PI);

			this.#hasChanges = true;
		}
	}

	#handelePlayerMovement(player, playerBox, playerDirection, name) {
		const wallBox =
			playerDirection === 1 ? this.#wallsBoxes[0] : this.#wallsBoxes[1];

		playerBox.setFromObject(player.getObjectByName(name));
		const target = player.position.y + this.#velocity * playerDirection;
		for (
			;
			player.position.y !== target;
			player.position.y += playerDirection
		) {
			if (playerBox.intersectsBox(wallBox)) break;
		}
		this.#hasChanges = true;
	}

	#checkPlayerCollisions(player, playerDirection, name) {
		const newPlayer = player.clone();
		const wallBox =
			playerDirection === 1 ? this.#wallsBoxes[0] : this.#wallsBoxes[1];

		newPlayer.position.y += this.#velocity * playerDirection;

		const playerBox = new THREE.Box3().setFromObject(
			newPlayer.getObjectByName(name)
		);

		if (playerBox.intersectsBox(wallBox)) {
			return false;
		}
		return true;
	}

	#checkCollisions() {
		this.#wallsBoxes.forEach(wallBox => {
			if (this.#ballBox.intersectsBox(wallBox)) {
				this.#handleBallWallCollision();
			}
		});

		if (this.#ballBox.intersectsBox(this.#goalRBox)) {
			this.#handleBallGoalCollision('goalR');
		}
		if (this.#ballBox.intersectsBox(this.#goalLBox)) {
			this.#handleBallGoalCollision('goalL');
		}

		if (this.#ballBox.intersectsBox(this.#playerBox)) {
			this.#handlePlayerCollision(this.#player);
		}

		if (this.#ballBox.intersectsBox(this.#player2Box)) {
			this.#handlePlayerCollision(this.#player2);
		}
	}

	#handlePlayerCollision(player) {
		const direction = this.#ball.position
			.clone()
			.sub(player.position)
			.normalize();
		direction.x =
			Math.sign(direction.x) *
			Math.max(Math.abs(direction.x), this.#minDir);
		direction.y =
			Math.sign(direction.y) *
			Math.max(Math.abs(direction.y), this.#minDir);
		direction.z =
			Math.sign(direction.z) *
			Math.max(Math.abs(direction.z), this.#minDir);
		this.#ballDirection = direction.multiplyScalar(this.#velocity);
	}

	#handleBallWallCollision() {
		this.#ballDirection.y = -this.#ballDirection.y;
	}

	#handleBallGoalCollision(goal) {
		goal === 'goalR' ? this.#scoreL++ : this.#scoreR++;
		this.#ball.position.set(0, 0, 0);
		this.#updateScoreL(String(this.#scoreL));
		this.#updateScoreR(String(this.#scoreR));
		this.startBall();
	}

	#setObjects(model) {
		this.#ball = model.getObjectByName('Ball');
		this.#player = model.getObjectByName('Player');
		this.#player2 = model.getObjectByName('PlayerTwo');
		this.#goalR = model.getObjectByName('Goal_Right');
		this.#goalL = model.getObjectByName('Goal_Left');
		this.#walls = model.getObjectByName('Walls');
		this.#walls.children.forEach(wall =>
			this.#wallsBoxes.push(new THREE.Box3().setFromObject(wall))
		);
		this.#goalRBox.setFromObject(this.#goalR);
		this.#goalLBox.setFromObject(this.#goalL);
		this.#scoreLText = model.getObjectByName('ScoreL');
		this.#scoreRText = model.getObjectByName('ScoreR');

		this.#resetScore();
	}

	moveUp() {
		if (this.#checkPlayerCollisions(this.#player, -1, 'Racket')) {
			this.#playerDirection = -1;
			this.#hasChanges = true;
		} else {
			this.#playerDirection = 0;
			this.#hasChanges = true;
		}
	}

	moveDown() {
		if (this.#checkPlayerCollisions(this.#player, 1, 'Racket')) {
			this.#playerDirection = 1;
			this.#hasChanges = true;
		} else {
			this.#playerDirection = 0;
			this.#hasChanges = true;
		}
	}

	moveUp2() {
		if (this.#checkPlayerCollisions(this.#player2, -1, 'Racket001')) {
			this.#player2Direction = -1;
			this.#hasChanges = true;
		} else {
			this.#player2Direction = 0;
			this.#hasChanges = true;
		}
	}

	moveDown2() {
		if (this.#checkPlayerCollisions(this.#player2, 1, 'Racket001')) {
			this.#player2Direction = 1;
			this.#hasChanges = true;
		} else {
			this.#player2Direction = 0;
			this.#hasChanges = true;
		}
	}

	startBall() {
		let x = this.#random(-1.0, 1.0);
		let y = this.#random(-1.0, 1.0);

		if (Math.abs(x) < this.#minDir) x = Math.sign(x) * this.#minDir;
		if (Math.abs(y) < this.#minDir) y = Math.sign(y) * this.#minDir;

		this.#ballDirection = new THREE.Vector3(x, y).multiplyScalar(
			this.#velocity
		);
		this.#hasChanges = true;
	}

	stopPlayerMovement() {
		this.#playerDirection = 0;
		this.#hasChanges = true;
	}

	stopPlayer2Movement() {
		this.#player2Direction = 0;
		this.#hasChanges = true;
	}

	#random(min, max) {
		return Math.random() * (max - min) + min;
	}

	dispose() {
		if (this.#ball) this.#ball.geometry.dispose();
		if (this.#ball.material) this.#ball.material.dispose();
		if (this.#renderer) {
			this.#renderer.dispose();
			this.#renderer = null;
		}
		this.#scene.traverse(object => {
			if (object.geometry) object.geometry.dispose();
			if (object.material) object.material.dispose();
		});
	}
}

export default new Game();
