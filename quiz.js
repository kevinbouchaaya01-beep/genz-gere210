import { scenes, LIVE_QUESTION_COUNT } from './scenes.js?v=6';
import { auth, db, signInAnonymously, ref, set } from './firebase.js?v=2';

const app = document.querySelector('#app');
const choices = [];
let current = 0;
let sending = false;

document.querySelector('#start').onclick = renderScene;

function renderScene() {
  const [topic, situation, message, prompt, answers, tip] = scenes[current];
  app.className = 'quiz';
  app.innerHTML = `
    <p class="eyebrow">QUESTION ${current + 1} OF ${scenes.length} · ${topic.toUpperCase()}${current >= LIVE_QUESTION_COUNT ? " · DISCUSSION" : ""}</p>
    <div class="track" aria-hidden="true">${scenes.map((_, i) => '<i class="' + (i < current ? 'done' : i === current ? 'current' : '') + '"></i>').join('')}</div>
    <div class="scene" data-tone="${current % 4}"><p>${situation}</p><div class="bubble">${message}</div></div>
    <h2 id="question" tabindex="-1">${prompt}</h2>
    <div class="choices" role="group" aria-labelledby="question"></div>
    <p class="feedback" hidden>${tip}</p>
    <div class="controls"><button class="quiet" id="back" ${current === 0 ? 'hidden' : ''}>Back</button>
    <button class="primary" id="next" hidden>${current === scenes.length - 1 ? 'Finish quiz' : 'Next question'}</button></div>`;
  const buttons = [];
  const next = app.querySelector('#next');
  const feedback = app.querySelector('.feedback');
  feedback.setAttribute('aria-live', 'polite');

  for (let position = 0; position < answers.length; position++) {
    const index = (position + current + 1) % answers.length;
    const button = document.createElement('button');
    button.className = 'choice';
    button.innerHTML = `<span aria-hidden="true">${'ABC'[position]}</span>`;
    button.append(document.createTextNode(answers[index]));
    button.dataset.index = index;
    button.onclick = () => {
      choices[current] = index;
      showChoice();
    };
    buttons.push(button);
    app.querySelector('.choices').append(button);
  }

  function showChoice() {
    const picked = choices[current];
    buttons.forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.index) === picked));
    next.hidden = feedback.hidden = picked === undefined;
  }
  showChoice();

  app.querySelector('#back').onclick = () => {
    current--;
    renderScene();
  };
  next.onclick = () => {
    if (choices[current] === undefined) return;
    current++;
    if (current === scenes.length) renderSummary();
    else renderScene();
  };
  app.querySelector('#question').focus({ preventScroll: true });
}

function renderSummary() {
  const classroomChoice = scenes[2][4][choices[2]];
  app.innerHTML = `
    <p class="eyebrow">QUIZ COMPLETE</p>
    <h2 tabindex="-1">Keep the conversation going</h2>
    <p>When the professor said “Because that’s the rule,” you chose: <strong>${classroomChoice}.</strong></p>
    <div class="scene" data-tone="2"><p>Try saying it with a reason</p><div class="bubble better">Please put your phones away for five minutes so everyone can hear.</div></div>
    <h3>Your discussion picks</h3>
    <p><strong>How you’d like to hear a rule</strong><br>${scenes[8][4][choices[8]]}</p>
    <p><strong>How you’d speak up in a group</strong><br>${scenes[9][4][choices[9]]}</p>
    <p>Compare your picks when the class talks through questions 9 and 10.</p>
    <p class="status" id="status" role="status">Saving your anonymous responses…</p>
    <button class="primary" id="retry" hidden>Try sending again</button>`;
  app.querySelector('h2').focus({ preventScroll: true });
  app.querySelector('#retry').onclick = submit;
  submit();
}

async function submit() {
  if (sending) return;
  sending = true;
  const status = app.querySelector('#status');
  const retry = app.querySelector('#retry');
  retry.hidden = true;
  status.textContent = 'Saving your anonymous responses…';
  try {
    await auth.authStateReady();
    const user = auth.currentUser || (await signInAnonymously(auth)).user;
    if (!user.isAnonymous) {
      status.textContent = 'A presenter is signed in on this browser. Open the quiz in a private window to send your answers.';
      return;
    }
    const response = Object.fromEntries(choices.slice(0, LIVE_QUESTION_COUNT).map((value, index) => ['q' + index, value]));
    await set(ref(db, 'responses/' + user.uid), response);
    status.textContent = 'Quiz complete! Your anonymous responses are in the class results.';
  } catch (error) {
    if (error.code === 'PERMISSION_DENIED' || error.code === 'database/permission-denied') {
      status.textContent = 'We couldn’t add your answers. You may already have submitted from this browser.';
    } else {
      status.textContent = 'We couldn’t send your answers. Check your connection and try again.';
      retry.hidden = false;
    }
  } finally {
    sending = false;
  }
}
