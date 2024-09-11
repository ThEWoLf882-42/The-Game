import * as THREE from 'three';
import * as CANNON from 'cannon';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

class SceneApp {
	#camera;
	#scene;
	#renderer;
	#controls;
	#mixer;
	#world;

	#ball;
	#player;
	#player2;
	#goalR;
	#goalL;
	#walls;

	#wallsBoxes = [];
	#playerBox;
	#player2Box;
	#ballBox;
	#goalRBox;
	#goalLBox;

	#velocity = 20;
	#ballDirection = new THREE.Vector3();
	#minDir = 0.8;
	#playerDirection = 0;
	#player2Direction = 0;
	#hasChanges = false;

	#lastFrameTime = 0;
	#frameRate = 60;

	constructor() {
		this.#init();
	}

	#init() {
		this.#createScene();
		this.#createCamera();
		this.#createRenderer();
		this.#createControls();
		this.#loadEnvironment();
		this.#initPhysics();
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

	#initPhysics() {
		this.#world = new CANNON.World();
		this.#world.gravity.set(0, -9.81, 0);

		this.#setupPhysics();
	}

	#setupPhysics() {
		if (this.#ball) {
			this.#createPhysicsBody(this.#ball, 1);
		}
		if (this.#player) {
			this.#createPhysicsBody(this.#player.getObjectByName('Racket'), 1);
		}
		if (this.#player2) {
			this.#createPhysicsBody(
				this.#player2.getObjectByName('Racket001'),
				1
			);
		}
		if (this.#walls) {
			this.#walls.children.forEach(wall => {
				this.#createPhysicsBody(wall, 0);
			});
		}
	}

	#createPhysicsBody(object, mass) {
		const shape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
		const body = new CANNON.Body({
			mass: mass,
			position: new CANNON.Vec3(
				object.position.x,
				object.position.y,
				object.position.z
			),
			quaternion: new CANNON.Quaternion(
				object.rotation.x,
				object.rotation.y,
				object.rotation.z,
				1
			),
		});

		if (mass > 0) {
			body.addShape(shape);
			this.#world.addBody(body);
		} else {
			body.type = CANNON.Body.STATIC;
			body.addShape(shape);
			this.#world.addBody(body);
		}

		object.physicsBody = body;
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
		if (now - this.#lastFrameTime > 1000 / this.#frameRate) {
			this.#lastFrameTime = now;
			this.#update();
			if (this.#mixer) this.#mixer.update(0.01);
			if (this.#hasChanges) this.#render();
			this.#hasChanges = false;
		}

		this.#world.step(1 / 60);

		this.#updatePhysicsObjects();

		requestAnimationFrame(() => this.#animate());
	}

	#update() {
		this.#hasChanges = false;

		if (this.#ball) {
			this.#ball.position.add(this.#ballDirection);
			this.#checkCollisions();
			this.#hasChanges = true;
		}

		if (this.#player) {
			this.#player.position.y += this.#velocity * this.#playerDirection;
			this.#hasChanges = true;
		}

		if (this.#player2) {
			this.#player2.position.y += this.#velocity * this.#player2Direction;
			this.#hasChanges = true;
		}
	}

	#checkCollisions() {
		if (
			!this.#ball ||
			!this.#ballBox ||
			!this.#goalRBox ||
			!this.#goalLBox
		) {
			console.error(
				'Required objects or bounding boxes are not initialized.'
			);
			return;
		}

		// Update ball bounding box
		this.#ballBox.setFromObject(this.#ball);

		// Check if the ball has collided with the walls
		for (const wallBox of this.#wallsBoxes) {
			if (this.#ballBox.intersectsBox(wallBox)) {
				this.#handleBallWallCollision();
				break; // Exit loop after handling collision
			}
		}

		// Check if the ball has collided with the goals
		if (this.#ballBox.intersectsBox(this.#goalRBox)) {
			this.#handleBallGoalCollision('goalR');
		}
		if (this.#ballBox.intersectsBox(this.#goalLBox)) {
			this.#handleBallGoalCollision('goalL');
		}

		// Check if the ball has collided with the players
		if (this.#ballBox.intersectsBox(this.#playerBox)) {
			this.#handlePlayerCollision(this.#player);
		}
		if (this.#ballBox.intersectsBox(this.#player2Box)) {
			this.#handlePlayerCollision(this.#player2);
		}
	}

	#handlePlayerCollision(player) {
		const ballBody = this.#ball.physicsBody;
		const playerBody = player.physicsBody;

		// Calculate direction from player to ball
		const direction = new CANNON.Vec3()
			.copy(ballBody.position)
			.vsub(playerBody.position)
			.normalize();

		// Reflect the ball's velocity
		ballBody.velocity.copy(
			direction.scale(ballBody.velocity.length() * -1)
		);

		// Ensure ball maintains a minimum velocity
		if (ballBody.velocity.length() < this.#minDir) {
			ballBody.velocity.normalize().scale(this.#minDir);
		}
	}

	#handleBallWallCollision() {
		const ballBody = this.#ball.physicsBody;

		// Reflect the ball's velocity based on the collision
		ballBody.velocity.x *= -1; // Reflect the X direction
		ballBody.velocity.z *= -1; // Reflect the Z direction (if applicable)
	}

	#handleBallGoalCollision(goal) {
		console.log(`${goal} hit`);
		this.#ball.position.set(0, 0, 0);
		this.startBall();
	}

	#setObjects(model) {
		this.#ball = model.getObjectByName('Ball');
		this.#player = model.getObjectByName('Player');
		this.#player2 = model.getObjectByName('PlayerTwo');
		this.#goalR = model.getObjectByName('Goal_Right');
		this.#goalL = model.getObjectByName('Goal_Left');
		this.#walls = model.getObjectByName('Walls');

		console.log(this.#player2);

		// Ensure bounding boxes are updated
		this.#ballBox = new THREE.Box3().setFromObject(this.#ball);
		this.#playerBox = new THREE.Box3().setFromObject(this.#player);
		this.#player2Box = new THREE.Box3().setFromObject(this.#player2);

		this.#goalR.geometry.computeBoundingBox();
		this.#goalL.geometry.computeBoundingBox();
		this.#goalRBox = this.#goalR.geometry.boundingBox.clone();
		this.#goalLBox = this.#goalL.geometry.boundingBox.clone();

		this.#wallsBoxes = [];
		this.#walls.children.forEach(wall => {
			const box = new THREE.Box3().setFromObject(wall);
			this.#wallsBoxes.push(box);
		});
	}

	moveUp() {
		this.#playerDirection = -1;
		this.#hasChanges = true;
	}

	moveDown() {
		this.#playerDirection = 1;
		this.#hasChanges = true;
	}

	moveUp2() {
		this.#player2Direction = -1;
		this.#hasChanges = true;
	}

	moveDown2() {
		this.#player2Direction = 1;
		this.#hasChanges = true;
	}

	startBall() {
		const x = this.#random(-1.0, 1.0) * this.#velocity;
		const y = this.#random(-1.0, 1.0) * this.#velocity;

		if (Math.abs(x) < this.#minDir) x = Math.sign(x) * this.#minDir;
		if (Math.abs(y) < this.#minDir) y = Math.sign(y) * this.#minDir;

		this.#ballDirection = new THREE.Vector3(x, y);
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

	#updatePhysicsObjects() {
		this.#scene.traverse(object => {
			if (object.physicsBody) {
				const body = object.physicsBody;
				object.position.set(
					body.position.x,
					body.position.y,
					body.position.z
				);
				object.rotation.set(
					body.quaternion.x,
					body.quaternion.y,
					body.quaternion.z,
					body.quaternion.w
				);
			}
		});
	}

	dispose() {
		if (this.#ball) {
			this.#ball.geometry.dispose();
			if (this.#ball.material) this.#ball.material.dispose();
		}
		if (this.#renderer) {
			this.#renderer.dispose();
			this.#renderer = null;
		}
		this.#scene.traverse(object => {
			if (object.geometry) object.geometry.dispose();
			if (object.material) object.material.dispose();
		});
		if (this.#world) {
			this.#world.bodies.forEach(body => this.#world.removeBody(body));
			this.#world = null;
		}
	}
}

const app = new SceneApp();

const keyState = new Set();

window.addEventListener('keydown', e => {
	keyState.add(e.key);
	updateMovement();
});

window.addEventListener('keyup', e => {
	keyState.delete(e.key);
	updateMovement();
});

function updateMovement() {
	app.stopPlayerMovement();
	app.stopPlayer2Movement();

	if (keyState.has(' ')) app.startBall();
	if (keyState.has('ArrowUp')) app.moveUp2();
	if (keyState.has('ArrowDown')) app.moveDown2();
	if (keyState.has('w')) app.moveUp();
	if (keyState.has('s')) app.moveDown();
}
