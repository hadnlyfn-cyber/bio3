const intro = document.getElementById("intro");
const bioCard = document.getElementById("bioCard");
const typingName = document.getElementById("typingName");

const audio = document.getElementById("audio");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");

const progress = document.getElementById("progress");
const volume = document.getElementById("volume");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

const visualizer = document.getElementById("visualizer");
const visualizerCtx = visualizer.getContext("2d");

const particlesCanvas = document.getElementById("particles");
const particlesCtx = particlesCanvas.getContext("2d");

let audioCtx = null;
let analyser = null;
let source = null;
let freqData = null;

let visualizerStarted = false;
let siteEntered = false;
let seeking = false;

let lastBass = 0;
let lastMid = 0;
let lastGlow = 0;

let previousVolume = Number(volume.value) || 0.75;

const particles = [];

audio.volume = previousVolume;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(current, target, speed) {
  return current + (target - current) * speed;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${secs}`;
}

function setCssAudioVars() {
  document.documentElement.style.setProperty("--bass", lastBass.toFixed(3));
  document.documentElement.style.setProperty("--mid", lastMid.toFixed(3));
  document.documentElement.style.setProperty("--glow", lastGlow.toFixed(3));
}

function typeNickname() {
  const text = typingName.dataset.text || "ay3ent";
  typingName.textContent = "";

  let index = 0;

  const timer = setInterval(() => {
    typingName.textContent += text[index];
    index += 1;

    if (index >= text.length) {
      clearInterval(timer);
      document.body.classList.add("typing-done");
    }
  }, 180);
}

async function setupAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    audioCtx = new AudioContextClass();
    analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.84;

    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    freqData = new Uint8Array(analyser.frequencyBinCount);
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
}

async function playAudio() {
  try {
    await setupAudio();
    await audio.play();
    updatePlayState();

    if (!visualizerStarted) {
      visualizerStarted = true;
      animateAudio();
    }
  } catch (error) {
    console.warn("Audio start was blocked or failed:", error);
    updatePlayState();
  }
}

function pauseAudio() {
  audio.pause();
  updatePlayState();
}

function updatePlayState() {
  playIcon.textContent = audio.paused ? "▶" : "❚❚";
}

function updateMuteState() {
  if (audio.muted || audio.volume === 0) {
    muteIcon.textContent = "🔇";
  } else if (audio.volume < 0.45) {
    muteIcon.textContent = "🔉";
  } else {
    muteIcon.textContent = "🔊";
  }
}

function updateProgress() {
  if (!audio.duration || seeking) return;

  const value = (audio.currentTime / audio.duration) * 100;
  progress.value = Number.isFinite(value) ? value : 0;

  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
}

function seekAudio() {
  if (!audio.duration) return;

  const percent = Number(progress.value) / 100;
  audio.currentTime = percent * audio.duration;
  currentTimeEl.textContent = formatTime(audio.currentTime);
}

function enterSite() {
  if (siteEntered) return;

  siteEntered = true;
  document.body.classList.add("entered");

  setTimeout(typeNickname, 430);
  playAudio();
}

function getAverage(data, start, end) {
  let sum = 0;
  let count = 0;

  for (let i = start; i < end && i < data.length; i += 1) {
    sum += data[i];
    count += 1;
  }

  return count ? sum / count / 255 : 0;
}

function resizeVisualizer() {
  const rect = visualizer.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  visualizer.width = Math.max(1, Math.floor(rect.width * ratio));
  visualizer.height = Math.max(1, Math.floor(rect.height * ratio));

  visualizerCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawIdleVisualizer() {
  const width = visualizer.clientWidth;
  const height = visualizer.clientHeight;

  visualizerCtx.clearRect(0, 0, width, height);

  const bars = 48;
  const gap = 4;
  const barWidth = (width - gap * (bars - 1)) / bars;

  for (let i = 0; i < bars; i += 1) {
    const wave = Math.sin(Date.now() * 0.002 + i * 0.45);
    const barHeight = 8 + Math.abs(wave) * 16;
    const x = i * (barWidth + gap);
    const y = height - barHeight - 8;

    const gradient = visualizerCtx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, "rgba(255,255,255,0.8)");
    gradient.addColorStop(0.55, "rgba(188,120,255,0.55)");
    gradient.addColorStop(1, "rgba(120,45,255,0.08)");

    visualizerCtx.fillStyle = gradient;
    visualizerCtx.shadowColor = "rgba(180,95,255,0.7)";
    visualizerCtx.shadowBlur = 10;
    visualizerCtx.beginPath();
    visualizerCtx.roundRect(x, y, barWidth, barHeight, 999);
    visualizerCtx.fill();
  }
}

function drawVisualizer(data) {
  const width = visualizer.clientWidth;
  const height = visualizer.clientHeight;

  visualizerCtx.clearRect(0, 0, width, height);

  const bars = 56;
  const gap = 3;
  const barWidth = (width - gap * (bars - 1)) / bars;
  const step = Math.max(1, Math.floor(data.length / bars));

  for (let i = 0; i < bars; i += 1) {
    const index = i * step;
    const value = data[index] / 255;
    const smoothValue = Math.pow(value, 0.82);
    const barHeight = clamp(smoothValue * height * 0.95, 6, height - 8);

    const x = i * (barWidth + gap);
    const y = height - barHeight - 4;

    const gradient = visualizerCtx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, "rgba(255,255,255,0.98)");
    gradient.addColorStop(0.48, "rgba(211,170,255,0.9)");
    gradient.addColorStop(1, "rgba(135,50,255,0.16)");

    visualizerCtx.fillStyle = gradient;
    visualizerCtx.shadowColor = "rgba(190,110,255,0.85)";
    visualizerCtx.shadowBlur = 12 + lastBass * 22;

    visualizerCtx.beginPath();
    visualizerCtx.roundRect(x, y, barWidth, barHeight, 999);
    visualizerCtx.fill();
  }

  visualizerCtx.shadowBlur = 0;

  const glow = visualizerCtx.createRadialGradient(
    width / 2,
    height,
    0,
    width / 2,
    height,
    width * 0.65
  );

  glow.addColorStop(0, `rgba(255,255,255,${0.08 + lastBass * 0.18})`);
  glow.addColorStop(0.32, `rgba(170,80,255,${0.08 + lastMid * 0.18})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");

  visualizerCtx.fillStyle = glow;
  visualizerCtx.fillRect(0, 0, width, height);
}

function animateAudio() {
  if (!analyser || !freqData) {
    drawIdleVisualizer();
    requestAnimationFrame(animateAudio);
    return;
  }

  analyser.getByteFrequencyData(freqData);

  const bass = getAverage(freqData, 0, 10);
  const mid = getAverage(freqData, 10, 42);
  const high = getAverage(freqData, 42, freqData.length);

  const targetBass = audio.paused ? 0 : clamp(bass * 1.45, 0, 1);
  const targetMid = audio.paused ? 0 : clamp(mid * 1.25, 0, 1);
  const targetGlow = audio.paused ? 0 : clamp((bass + mid + high) / 2.2, 0, 1);

  lastBass = lerp(lastBass, targetBass, 0.16);
  lastMid = lerp(lastMid, targetMid, 0.13);
  lastGlow = lerp(lastGlow, targetGlow, 0.14);

  setCssAudioVars();

  if (audio.paused) {
    drawIdleVisualizer();
  } else {
    drawVisualizer(freqData);
  }

  requestAnimationFrame(animateAudio);
}

function resizeParticlesCanvas() {
  const ratio = window.devicePixelRatio || 1;

  particlesCanvas.width = Math.floor(window.innerWidth * ratio);
  particlesCanvas.height = Math.floor(window.innerHeight * ratio);
  particlesCanvas.style.width = `${window.innerWidth}px`;
  particlesCanvas.style.height = `${window.innerHeight}px`;

  particlesCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  createParticles();
}

function createParticles() {
  particles.length = 0;

  const amount = Math.floor(clamp(window.innerWidth / 11, 55, 145));

  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.34 + 0.12,
      alpha: Math.random() * 0.45 + 0.12,
      drift: Math.random() * 1.4 + 0.4,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function animateParticles() {
  particlesCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const particle of particles) {
    particle.phase += 0.006 + lastMid * 0.018;
    particle.y -= particle.speed * (1 + lastBass * 2.2);
    particle.x += Math.sin(particle.phase) * particle.drift * 0.18;

    if (particle.y < -12) {
      particle.y = window.innerHeight + 12;
      particle.x = Math.random() * window.innerWidth;
    }

    if (particle.x < -12) {
      particle.x = window.innerWidth + 12;
    }

    if (particle.x > window.innerWidth + 12) {
      particle.x = -12;
    }

    const radius = particle.radius * (1 + lastBass * 1.6);
    const alpha = particle.alpha * (0.48 + lastGlow * 1.25);

    particlesCtx.beginPath();
    particlesCtx.fillStyle = `rgba(255,255,255,${clamp(alpha, 0, 0.88)})`;
    particlesCtx.shadowColor = "rgba(170,85,255,0.9)";
    particlesCtx.shadowBlur = 8 + lastBass * 16;
    particlesCtx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    particlesCtx.fill();
  }

  particlesCtx.shadowBlur = 0;
  requestAnimationFrame(animateParticles);
}

intro.addEventListener("click", enterSite);

playBtn.addEventListener("click", () => {
  if (audio.paused) {
    playAudio();
  } else {
    pauseAudio();
  }
});

muteBtn.addEventListener("click", () => {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    audio.volume = previousVolume || 0.75;
    volume.value = audio.volume;
  } else {
    previousVolume = audio.volume;
    audio.muted = true;
  }

  updateMuteState();
});

volume.addEventListener("input", () => {
  const value = Number(volume.value);

  audio.volume = value;
  audio.muted = value === 0;

  if (value > 0) {
    previousVolume = value;
  }

  updateMuteState();
});

progress.addEventListener("pointerdown", () => {
  seeking = true;
});

progress.addEventListener("pointerup", () => {
  seekAudio();
  seeking = false;
});

progress.addEventListener("input", () => {
  if (!audio.duration) return;

  const percent = Number(progress.value) / 100;
  currentTimeEl.textContent = formatTime(percent * audio.duration);
});

audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", updateProgress);

audio.addEventListener("ended", () => {
  audio.currentTime = 0;
  updatePlayState();
});

document.addEventListener("mousemove", (event) => {
  const x = (event.clientX / window.innerWidth) * 100;
  const y = (event.clientY / window.innerHeight) * 100;

  document.documentElement.style.setProperty("--mouse-x", `${x}%`);
  document.documentElement.style.setProperty("--mouse-y", `${y}%`);
});

window.addEventListener("resize", () => {
  resizeVisualizer();
  resizeParticlesCanvas();
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);

    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);

    return this;
  };
}

resizeVisualizer();
resizeParticlesCanvas();
animateParticles();
drawIdleVisualizer();
updatePlayState();
updateMuteState();
