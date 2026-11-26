import { scenes, LIVE_QUESTION_COUNT } from './scenes.js?v=6';
import { auth, db, signInAnonymously, ref, set } from './firebase.js?v=2';

const app = document.querySelector('#app');
const choices = [];
let current = 0;
let sending = false;

document.querySelector('#start').onclick = renderScene;

function renderScene() {
  const [topic, situation, message, prompt, answers] = scenes[current];
  app.className = 'quiz';
  app.innerHTML = `
    <p class="eyebrow">QUESTION ${current + 1} OF ${scenes.length} · ${topic.toUpperCase()}${current >= LIVE_QUESTION_COUNT ? " · DISCUSSION" : ""}</p>
    <div class="track" aria-hidden="true">${scenes.map((_, i) => '<i class="' + (i < current ? 'done' : i === current ? 'current' : '') + '"></i>').join('')}</div>
    <div class="scene" data-tone="${current % 4}"><p>${situation}</p><div class="bubble">${message}</div></div>
    <h2 id="question" tabindex="-1">${prompt}</h2>
    <div class="choices" role="group" aria-labelledby="question"></div>
    <div class="controls"><button class="quiet" id="back" ${current === 0 ? 'hidden' : ''}>Back</button></div>`;
  const questionIndex = current;
  for (let position = 0; position < answers.length; position++) {
    const index = (position + current + 1) % answers.length;
    const button = document.createElement('button');
    button.className = 'choice';
    button.innerHTML = `<span aria-hidden="true">${'ABC'[position]}</span>`;
    button.append(document.createTextNode(answers[index]));
    button.dataset.index = index;
    if (choices[current] === index) button.classList.add('picked');
    button.onclick = () => {
      if (current !== questionIndex) return;
      choices[current] = index;
      current++;
      if (current === scenes.length) renderSummary();
      else renderScene();
    };
    app.querySelector('.choices').append(button);
  }

  app.querySelector('#back').onclick = () => {
    current--;
    renderScene();
  };
  app.querySelector('#question').focus({ preventScroll: true });
  app.scrollIntoView({block:'start'});
}

function renderSummary() {
  const points = choices.slice(0, LIVE_QUESTION_COUNT).reduce((sum, value) => sum + value, 0);
  const score = Math.round(points / (LIVE_QUESTION_COUNT * 2) * 100);
  const [profile, description] = score >= 70
    ? ['The expressive connector', 'You tend to ask what people mean, talk things through, and show how you feel.']
    : score >= 40
      ? ['The generation bridge', 'You switch between keeping it simple and opening up the conversation.']
      : ['The straightforward communicator', 'You tend to keep things clear, practical, and to the point.'];
  app.innerHTML = `
    <div class="reveal">
      <div><p class="eyebrow">YOUR GEN Z MATCH</p><h2 tabindex="-1">${profile}</h2><p>${description}</p></div>
      <div class="score" aria-label="${score} percent match">${score}<span>%</span></div>
    </div>
    <p class="score-scale"><strong>0–39%</strong> Straightforward <span>·</span> <strong>40–69%</strong> Bridge <span>·</span> <strong>70–100%</strong> Expressive</p>
    <p class="privacy">A playful match based on your first eight replies. Every style has its place.</p>
    <h3>Two replies to bring to class</h3>
    <div class="picks"><div><strong>How you’d like to hear a rule</strong><div class="bubble">${scenes[8][4][choices[8]]}</div></div>
    <div><strong>How you’d speak up in a group</strong><div class="bubble">${scenes[9][4][choices[9]]}</div></div></div>
    <p class="status" id="status" role="status">Saving your anonymous responses…</p>
    <button class="primary" id="retry" hidden>Try sending again</button>`;
  app.querySelector('h2').focus({ preventScroll: true });
  app.scrollIntoView({block:'start'});
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
