'use strict';

// SIMULAÇÃO NO NAVEGADOR. NÃO ACIONA PINOS DO ESP32.
// Na integração real, o ESP32 será a fonte dos estados e dos intertravamentos.
const STEP_DURATION = 1700; // milissegundos por andar, somente para simulação
const state = { floor: 3, destination: null, moving: 0, queue: [], busy: false, powered: true, epoch: 0 };

const el = (id) => document.getElementById(id);
const floorButtons = [...document.querySelectorAll('[data-call]')];
const sensors = [...document.querySelectorAll('[data-sensor]')];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function render() {
  el('currentFloor').textContent = `${state.floor}º`;
  el('destinationFloor').textContent = state.destination ? `${state.destination}º` : '—';
  el('destinationSuffix').textContent = state.destination ? 'andar' : 'Sem chamada';
  const status = !state.powered ? 'Desligado' : state.moving > 0 ? 'Subindo' : state.moving < 0 ? 'Descendo' : 'Parado';
  el('statusText').textContent = status;
  el('statusIcon').textContent = !state.powered ? '⏻' : state.moving > 0 ? '↑' : state.moving < 0 ? '↓' : '■';
  el('upIndicator').classList.toggle('active', state.moving > 0);
  el('downIndicator').classList.toggle('active', state.moving < 0);
  sensors.forEach((node) => node.classList.toggle('active', Number(node.dataset.sensor) === state.floor && state.moving === 0));
  floorButtons.forEach((button) => {
    button.disabled = !state.powered;
    button.classList.toggle('selected', state.powered && (state.destination === Number(button.dataset.call) || state.queue.includes(Number(button.dataset.call))));
  });
  el('powerButton').classList.toggle('off', !state.powered);
  el('powerButton').setAttribute('aria-pressed', String(state.powered));
  el('powerButton').setAttribute('aria-label', state.powered ? 'Desligar elevador' : 'Ligar elevador');
  el('powerLabel').textContent = state.powered ? 'ON' : 'OFF';
  el('cab').setAttribute('aria-label', `Cabine: referência do ${state.floor}º andar${state.moving ? ', em movimento' : ''}`);
  el('helpText').textContent = !state.powered ? 'Elevador desligado • chamadas bloqueadas' : state.busy ? `${status} para o ${state.destination}º andar • Chamadas pendentes: ${state.queue.length}` : 'Selecione o andar desejado para enviar uma chamada.';
}

// Os botões adicionam chamadas a uma fila, preservando solicitações recebidas durante o movimento.
function requestFloor(floor) {
  if (!state.powered || !Number.isInteger(floor) || floor < 1 || floor > 4) return;
  if (state.destination === floor || state.queue.includes(floor)) return;
  if (floor === state.floor && !state.busy) return;
  state.queue.push(floor);
  render();
  if (!state.busy) void processQueue();
}

// A chave OFF cancela imediatamente a fila e interrompe a animacao.
// Aqui so existe simulacao: nao e um circuito de parada de emergencia real.
function togglePower() {
  state.powered = !state.powered;
  state.epoch++;  // invalida qualquer movimento assíncrono anterior
  if (!state.powered) {
    const cab = el('cab');
    const currentBottom = getComputedStyle(cab).bottom;
    cab.style.transition = 'none';
    cab.style.bottom = currentBottom; // congela na posicao visual atual
    state.queue = [];
    state.destination = null;
    state.moving = 0;
    state.busy = false;
  } else {
    const cab = el('cab');
    // Retorna à última referência confirmada antes de aceitar novas chamadas.
    cab.style.setProperty('--position', state.floor);
    cab.style.bottom = '';
    requestAnimationFrame(() => { cab.style.transition = ''; });
  }
  render();
}

async function processQueue() {
  if (state.busy || !state.powered) return;
  state.busy = true;
  const epoch = state.epoch;
  while (state.queue.length && state.powered && epoch === state.epoch) {
    state.destination = state.queue.shift();
    render();
    while (state.floor !== state.destination && state.powered && epoch === state.epoch) {
      const nextFloor = state.floor + Math.sign(state.destination - state.floor);
      state.moving = Math.sign(nextFloor - state.floor);
      el('cab').style.setProperty('--position', nextFloor);
      render();
      await sleep(STEP_DURATION);
      if (!state.powered || epoch !== state.epoch) return;
      state.floor = nextFloor; // sensor simulado confirmou o andar
      render();
    }
    if (!state.powered || epoch !== state.epoch) return;
    state.moving = 0;
    state.destination = null;
    render();
    await sleep(350);
    if (!state.powered || epoch !== state.epoch) return;
  }
  state.busy = false;
  render();
}

el('powerButton').addEventListener('click', togglePower);
floorButtons.forEach((button) => button.addEventListener('click', () => requestFloor(Number(button.dataset.call))));
render();
