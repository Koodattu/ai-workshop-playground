export interface Template {
  id: string;
  nameKey: string;
  code: string;
}

// Type for translation messages
type Messages = {
  templateContent: {
    [key: string]: {
      [key: string]: string;
    };
  };
};

export const TEMPLATES: Template[] = [
  {
    id: "simple-welcome",
    nameKey: "templates.simpleWelcome",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple Welcome</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 50px;
      background: #f0f0f0;
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <h1>{{templateContent.simpleWelcome.title}}</h1>
  <p>{{templateContent.simpleWelcome.description}}</p>
</body>
</html>`,
  },
  {
    id: "simple-tailwind",
    nameKey: "templates.simpleTailwind",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple Tailwind</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-4xl font-bold text-center mb-8 text-gray-800">
      {{templateContent.simpleTailwind.title}}
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-2 text-blue-600">{{templateContent.simpleTailwind.card1Title}}</h2>
        <p class="text-gray-600">{{templateContent.simpleTailwind.card1Desc}}</p>
      </div>

      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-2 text-purple-600">{{templateContent.simpleTailwind.card2Title}}</h2>
        <p class="text-gray-600">{{templateContent.simpleTailwind.card2Desc}}</p>
      </div>
    </div>

    <div class="text-center">
      <button class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg">
        {{templateContent.simpleTailwind.button}}
      </button>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "simple-counter",
    nameKey: "templates.simpleCounter",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple Counter</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f0f0f0;
      margin: 0;
    }
    .container {
      text-align: center;
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    #counter {
      font-size: 48px;
      color: #2196F3;
      margin: 20px 0;
      font-weight: bold;
    }
    button {
      font-size: 18px;
      padding: 10px 20px;
      margin: 5px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .increment {
      background: #4CAF50;
      color: white;
    }
    .increment:hover {
      background: #45a049;
    }
    .decrement {
      background: #f44336;
      color: white;
    }
    .decrement:hover {
      background: #da190b;
    }
    .reset {
      background: #2196F3;
      color: white;
    }
    .reset:hover {
      background: #0b7dda;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{templateContent.simpleCounter.title}}</h1>
    <div id="counter">0</div>
    <div>
      <button class="decrement" onclick="decrement()">{{templateContent.simpleCounter.decrease}}</button>
      <button class="reset" onclick="reset()">{{templateContent.simpleCounter.reset}}</button>
      <button class="increment" onclick="increment()">{{templateContent.simpleCounter.increase}}</button>
    </div>
  </div>

  <script>
    let count = 0;
    const counterElement = document.getElementById('counter');

    function increment() {
      count++;
      updateDisplay();
    }

    function decrement() {
      count--;
      updateDisplay();
    }

    function reset() {
      count = 0;
      updateDisplay();
    }

    function updateDisplay() {
      counterElement.textContent = count;
    }
  </script>
</body>
</html>`,
  },
  {
    id: "simple-todo",
    nameKey: "templates.simpleTodo",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple Todo</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f0f0f0;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    input {
      flex: 1;
      padding: 10px;
      border: 2px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
    }
    button {
      padding: 10px 20px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background: #0b7dda;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 12px;
      background: #f9f9f9;
      margin-bottom: 8px;
      border-radius: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .delete-btn {
      background: #f44336;
      padding: 5px 10px;
      font-size: 14px;
    }
    .delete-btn:hover {
      background: #da190b;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{templateContent.simpleTodo.title}}</h1>
    <div class="input-group">
      <input type="text" id="todoInput" placeholder="{{templateContent.simpleTodo.placeholder}}">
      <button onclick="addTodo()">{{templateContent.simpleTodo.add}}</button>
    </div>
    <ul id="todoList"></ul>
  </div>

  <script>
    const input = document.getElementById('todoInput');
    const list = document.getElementById('todoList');

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTodo();
    });

    function addTodo() {
      const text = input.value.trim();
      if (!text) return;

      const li = document.createElement('li');
      li.innerHTML = \`
        <span>\${text}</span>
        <button class="delete-btn" onclick="this.parentElement.remove()">{{templateContent.simpleTodo.delete}}</button>
      \`;
      list.appendChild(li);
      input.value = '';
    }
  </script>
</body>
</html>`,
  },
  {
    id: "welcome",
    nameKey: "templates.welcome",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Workshop</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      font-family: system-ui, sans-serif;
      color: white;
    }

    .container {
      text-align: center;
      padding: 2rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, #00d4ff, #ff6b35);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    p {
      color: #888;
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{templateContent.welcome.title}}</h1>
    <p>{{templateContent.welcome.description}}</p>
  </div>
</body>
</html>`,
  },
  {
    id: "tailwind",
    nameKey: "templates.tailwind",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tailwind CSS Showcase</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen">
  <div class="container mx-auto px-4 py-12">
    <!-- Header -->
    <header class="text-center mb-16">
      <h1 class="text-5xl font-bold text-white mb-4">
        <span class="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          {{templateContent.tailwind.title}}
        </span>
      </h1>
      <p class="text-slate-300 text-lg">{{templateContent.tailwind.subtitle}}</p>
    </header>

    <!-- Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      <!-- Card 1 -->
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/20">
        <div class="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg mb-4 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">{{templateContent.tailwind.fastDev}}</h3>
        <p class="text-slate-400">{{templateContent.tailwind.fastDevDesc}}</p>
      </div>

      <!-- Card 2 -->
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
        <div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg mb-4 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">{{templateContent.tailwind.customizable}}</h3>
        <p class="text-slate-400">{{templateContent.tailwind.customizableDesc}}</p>
      </div>

      <!-- Card 3 -->
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-green-500 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20">
        <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg mb-4 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">{{templateContent.tailwind.responsive}}</h3>
        <p class="text-slate-400">{{templateContent.tailwind.responsiveDesc}}</p>
      </div>
    </div>

    <!-- Features Section -->
    <div class="bg-gradient-to-r from-slate-800/50 to-slate-800/30 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
      <h2 class="text-3xl font-bold text-white mb-6">{{templateContent.tailwind.keyFeatures}}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h4 class="text-white font-semibold mb-1">{{templateContent.tailwind.utilityFirst}}</h4>
            <p class="text-slate-400 text-sm">{{templateContent.tailwind.utilityFirstDesc}}</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h4 class="text-white font-semibold mb-1">{{templateContent.tailwind.componentFriendly}}</h4>
            <p class="text-slate-400 text-sm">{{templateContent.tailwind.componentFriendlyDesc}}</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h4 class="text-white font-semibold mb-1">{{templateContent.tailwind.performance}}</h4>
            <p class="text-slate-400 text-sm">{{templateContent.tailwind.performanceDesc}}</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0 mt-1">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h4 class="text-white font-semibold mb-1">{{templateContent.tailwind.darkMode}}</h4>
            <p class="text-slate-400 text-sm">{{templateContent.tailwind.darkModeDesc}}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Button -->
    <div class="text-center mt-12">
      <button class="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 transform hover:scale-105">
        {{templateContent.tailwind.getStarted}}
      </button>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "snake",
    nameKey: "templates.snake",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snake Game</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      font-family: 'Courier New', monospace;
      color: white;
      padding: 20px;
    }

    .game-container {
      text-align: center;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, #00ff88, #00d4ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stats {
      display: flex;
      gap: 2rem;
      justify-content: center;
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-label {
      color: #666;
      font-size: 0.8rem;
      text-transform: uppercase;
    }

    .stat-value {
      color: #00ff88;
      font-weight: bold;
    }

    canvas {
      border: 2px solid #00d4ff;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
      background: #1a1a2e;
    }

    .controls {
      margin-top: 1rem;
      color: #888;
      font-size: 0.9rem;
    }

    .game-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .game-btn {
      padding: 0.75rem 2rem;
      background: linear-gradient(90deg, #00ff88, #00d4ff);
      border: none;
      border-radius: 6px;
      color: #0a0a0f;
      font-weight: bold;
      cursor: pointer;
      font-size: 1rem;
      transition: transform 0.2s, opacity 0.2s;
      font-family: 'Courier New', monospace;
    }

    .game-btn:hover:not(:disabled) {
      transform: scale(1.05);
    }

    .game-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .game-over {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 2rem;
      border-radius: 12px;
      border: 2px solid #ff6b35;
      display: none;
      text-align: center;
    }

    .game-over.show {
      display: block;
    }

    .game-over h2 {
      color: #ff6b35;
      margin-bottom: 1rem;
    }

    .game-over button {
      margin-top: 1rem;
      padding: 0.75rem 2rem;
      background: linear-gradient(90deg, #00ff88, #00d4ff);
      border: none;
      border-radius: 6px;
      color: #0a0a0f;
      font-weight: bold;
      cursor: pointer;
      font-size: 1rem;
      transition: transform 0.2s;
    }

    .game-over button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="game-container">
    <h1>🐍 {{templateContent.snake.title}}</h1>

    <div class="stats">
      <div class="stat">
        <span class="stat-label">{{templateContent.snake.score}}</span>
        <span class="stat-value" id="score">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">{{templateContent.snake.highScore}}</span>
        <span class="stat-value" id="highScore">0</span>
      </div>
    </div>

    <canvas id="gameCanvas" width="400" height="400"></canvas>

    <div class="game-buttons">
      <button class="game-btn" id="startBtn" onclick="startGame()">{{templateContent.snake.start}}</button>
      <button class="game-btn" id="pauseBtn" onclick="togglePause()" disabled>{{templateContent.snake.pause}}</button>
    </div>

    <div class="controls">
      {{templateContent.snake.controls}}
    </div>
  </div>

  <div class="game-over" id="gameOver">
    <h2>{{templateContent.snake.gameOver}}</h2>
    <p>{{templateContent.snake.yourScore}} <span id="finalScore">0</span></p>
    <button onclick="restartGame()">{{templateContent.snake.playAgain}}</button>
  </div>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');
    const gameOverElement = document.getElementById('gameOver');
    const finalScoreElement = document.getElementById('finalScore');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    let snake = [{ x: 10, y: 10 }];
    let velocity = { x: 0, y: 0 };
    let food = { x: 15, y: 15 };
    let score = 0;
    let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    let gameRunning = false;
    let gamePaused = false;
    let gameStarted = false;
    let gameSpeed = 100;
    let gameLoop;

    highScoreElement.textContent = highScore;

    // Draw initial state
    clearCanvas();
    drawFood();
    drawSnake();

    function drawGame() {
      if (!gameRunning || gamePaused) return;

      moveSnake();

      if (checkCollision()) {
        endGame();
        return;
      }

      if (checkFoodCollision()) {
        score++;
        scoreElement.textContent = score;
        generateFood();
        if (score > highScore) {
          highScore = score;
          highScoreElement.textContent = highScore;
          localStorage.setItem('snakeHighScore', highScore);
        }
      } else {
        snake.pop();
      }

      clearCanvas();
      drawFood();
      drawSnake();
    }

    function clearCanvas() {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawSnake() {
      snake.forEach((segment, index) => {
        const gradient = ctx.createLinearGradient(
          segment.x * gridSize,
          segment.y * gridSize,
          (segment.x + 1) * gridSize,
          (segment.y + 1) * gridSize
        );

        if (index === 0) {
          gradient.addColorStop(0, '#00ff88');
          gradient.addColorStop(1, '#00d4ff');
        } else {
          gradient.addColorStop(0, '#00d4ff');
          gradient.addColorStop(1, '#0088ff');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(
          segment.x * gridSize + 1,
          segment.y * gridSize + 1,
          gridSize - 2,
          gridSize - 2
        );
      });
    }

    function drawFood() {
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    function moveSnake() {
      const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
      snake.unshift(head);
    }

    function checkCollision() {
      const head = snake[0];

      // Wall collision
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return true;
      }

      // Self collision
      for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
          return true;
        }
      }

      return false;
    }

    function checkFoodCollision() {
      return snake[0].x === food.x && snake[0].y === food.y;
    }

    function generateFood() {
      food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
      };

      // Make sure food doesn't spawn on snake
      for (let segment of snake) {
        if (food.x === segment.x && food.y === segment.y) {
          generateFood();
          break;
        }
      }
    }

    function startGame() {
      if (!gameStarted) {
        gameStarted = true;
        gameRunning = true;
        gamePaused = false;
        startBtn.disabled = true;
        pauseBtn.disabled = false;

        gameLoop = setInterval(drawGame, gameSpeed);
      }
    }

    function togglePause() {
      if (!gameStarted) return;

      gamePaused = !gamePaused;

      if (gamePaused) {
        pauseBtn.textContent = '{{templateContent.snake.resume}}';
        clearInterval(gameLoop);
      } else {
        pauseBtn.textContent = '{{templateContent.snake.pause}}';
        gameLoop = setInterval(drawGame, gameSpeed);
      }
    }

    function endGame() {
      gameRunning = false;
      gameStarted = false;
      clearInterval(gameLoop);
      finalScoreElement.textContent = score;
      gameOverElement.classList.add('show');
      startBtn.disabled = false;
      pauseBtn.disabled = true;
    }

    function restartGame() {
      snake = [{ x: 10, y: 10 }];
      velocity = { x: 0, y: 0 };
      score = 0;
      scoreElement.textContent = score;
      gameRunning = false;
      gamePaused = false;
      gameStarted = false;
      gameOverElement.classList.remove('show');
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      pauseBtn.textContent = '{{templateContent.snake.pause}}';
      generateFood();
      clearCanvas();
      drawFood();
      drawSnake();
    }

    document.addEventListener('keydown', (e) => {
      // Prevent default arrow key scrolling
      if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      // Auto-start game on first key press if not started
      if (!gameStarted && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        startGame();
      }

      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (velocity.y === 0) {
            velocity = { x: 0, y: -1 };
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (velocity.y === 0) {
            velocity = { x: 0, y: 1 };
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (velocity.x === 0) {
            velocity = { x: -1, y: 0 };
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (velocity.x === 0) {
            velocity = { x: 1, y: 0 };
          }
          break;
      }
    });
  </script>
</body>
</html>`,
  },
  {
    id: "tictactoe",
    nameKey: "templates.tictactoe",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tic-Tac-Toe</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      font-family: system-ui, sans-serif;
      color: white;
      padding: 20px;
    }

    .game-container {
      text-align: center;
      max-width: 500px;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(90deg, #ff6b35, #f7931e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .status {
      font-size: 1.3rem;
      margin-bottom: 1.5rem;
      min-height: 2rem;
      color: #00d4ff;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(3, 120px);
      grid-template-rows: repeat(3, 120px);
      gap: 10px;
      margin: 0 auto 2rem;
      padding: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 212, 255, 0.2);
    }

    .cell {
      background: linear-gradient(145deg, #1a1a2e, #0f0f1a);
      border: 2px solid #333;
      border-radius: 8px;
      font-size: 3rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .cell:hover:not(.taken) {
      background: linear-gradient(145deg, #2a2a3e, #1a1a2e);
      border-color: #00d4ff;
      transform: scale(1.05);
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
    }

    .cell.taken {
      cursor: not-allowed;
    }

    .cell.x {
      color: #00d4ff;
      animation: pop 0.3s ease;
    }

    .cell.o {
      color: #ff6b35;
      animation: pop 0.3s ease;
    }

    .cell.winner {
      background: linear-gradient(145deg, #00d4ff22, #00d4ff11);
      animation: pulse 0.5s ease-in-out infinite;
    }

    @keyframes pop {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
      }
      50% {
        box-shadow: 0 0 40px rgba(0, 212, 255, 0.8);
      }
    }

    .controls {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2rem;
    }

    button {
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .reset-btn {
      background: linear-gradient(90deg, #00d4ff, #0088ff);
      color: white;
    }

    .reset-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0, 212, 255, 0.4);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 0.25rem;
    }

    .stat-value.x {
      color: #00d4ff;
    }

    .stat-value.o {
      color: #ff6b35;
    }

    .stat-value.draw {
      color: #888;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #666;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="game-container">
    <h1>⭕ {{templateContent.tictactoe.title}} ❌</h1>
    <div class="status" id="status"></div>

    <div class="board" id="board">
      <div class="cell" data-index="0"></div>
      <div class="cell" data-index="1"></div>
      <div class="cell" data-index="2"></div>
      <div class="cell" data-index="3"></div>
      <div class="cell" data-index="4"></div>
      <div class="cell" data-index="5"></div>
      <div class="cell" data-index="6"></div>
      <div class="cell" data-index="7"></div>
      <div class="cell" data-index="8"></div>
    </div>

    <div class="controls">
      <button class="reset-btn" onclick="resetGame()">{{templateContent.tictactoe.newGame}}</button>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value x" id="xWins">0</div>
        <div class="stat-label">{{templateContent.tictactoe.xWins}}</div>
      </div>
      <div class="stat">
        <div class="stat-value draw" id="draws">0</div>
        <div class="stat-label">{{templateContent.tictactoe.draws}}</div>
      </div>
      <div class="stat">
        <div class="stat-value o" id="oWins">0</div>
        <div class="stat-label">{{templateContent.tictactoe.oWins}}</div>
      </div>
    </div>
  </div>

  <script>
    const board = document.getElementById('board');
    const statusElement = document.getElementById('status');
    const cells = document.querySelectorAll('.cell');
    const xWinsElement = document.getElementById('xWins');
    const oWinsElement = document.getElementById('oWins');
    const drawsElement = document.getElementById('draws');

    // Translation strings
    const translations = {
      playerTurn: "{{templateContent.tictactoe.playerTurn}}",
      playerWins: "{{templateContent.tictactoe.playerWins}}",
      draw: "{{templateContent.tictactoe.draw}}"
    };

    let currentPlayer = 'X';
    let gameBoard = ['', '', '', '', '', '', '', '', ''];
    let gameActive = true;

    // Load stats from localStorage
    let stats = JSON.parse(localStorage.getItem('tictactoeStats')) || { xWins: 0, oWins: 0, draws: 0 };
    updateStatsDisplay();
    updateStatus();

    const winningConditions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];

    cells.forEach(cell => {
      cell.addEventListener('click', handleCellClick);
    });

    function handleCellClick(e) {
      const cell = e.target;
      const index = parseInt(cell.getAttribute('data-index'));

      if (gameBoard[index] !== '' || !gameActive) {
        return;
      }

      makeMove(cell, index);
    }

    function makeMove(cell, index) {
      gameBoard[index] = currentPlayer;
      cell.textContent = currentPlayer;
      cell.classList.add('taken', currentPlayer.toLowerCase());

      checkResult();
    }

    function updateStatus() {
      statusElement.textContent = translations.playerTurn.replace('{player}', currentPlayer);
    }

    function checkResult() {
      let roundWon = false;
      let winningCells = [];

      for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
          roundWon = true;
          winningCells = [a, b, c];
          break;
        }
      }

      if (roundWon) {
        statusElement.textContent = translations.playerWins.replace('{player}', currentPlayer) + ' 🎉';
        gameActive = false;

        // Highlight winning cells
        winningCells.forEach(index => {
          cells[index].classList.add('winner');
        });

        // Update stats
        if (currentPlayer === 'X') {
          stats.xWins++;
        } else {
          stats.oWins++;
        }
        saveStats();
        return;
      }

      const roundDraw = !gameBoard.includes('');
      if (roundDraw) {
        statusElement.textContent = translations.draw + ' 🤝';
        gameActive = false;
        stats.draws++;
        saveStats();
        return;
      }

      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      updateStatus();
    }

    function resetGame() {
      currentPlayer = 'X';
      gameBoard = ['', '', '', '', '', '', '', '', ''];
      gameActive = true;
      updateStatus();

      cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('taken', 'x', 'o', 'winner');
      });
    }

    function saveStats() {
      localStorage.setItem('tictactoeStats', JSON.stringify(stats));
      updateStatsDisplay();
    }

    function updateStatsDisplay() {
      xWinsElement.textContent = stats.xWins;
      oWinsElement.textContent = stats.oWins;
      drawsElement.textContent = stats.draws;
    }
  </script>
</body>
</html>`,
  },
];

export const DEFAULT_TEMPLATE_ID = "simple-welcome";

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/**
 * Get a localized version of a template
 * @param templateId - The ID of the template
 * @param language - The language code ('en' or 'fi')
 * @returns The template code with placeholders replaced with translations
 */
export function getLocalizedTemplate(templateId: string, language: "en" | "fi", messages: any): string {
  const template = getTemplateById(templateId);

  if (!template) {
    return "";
  }

  // For custom templates, return as-is
  if (templateId === "custom") {
    return template.code;
  }

  // Ensure we have messages
  if (!messages || !messages.templateContent) {
    console.error("No translations available");
    return template.code;
  }

  // Replace all placeholders in the template
  let localizedCode = template.code;
  const placeholderRegex = /\{\{(templateContent\.[^}]+)\}\}/g;

  localizedCode = localizedCode.replace(placeholderRegex, (match, path) => {
    // Parse the path (e.g., "templateContent.welcome.title")
    const parts = path.split(".");
    let value: any = messages;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        // If translation not found, return the placeholder as-is
        return match;
      }
    }

    return typeof value === "string" ? value : match;
  });

  return localizedCode;
}
