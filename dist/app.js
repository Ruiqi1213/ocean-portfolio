import { initOcean } from './ocean.js';
import { profile } from './profile.js';

const root = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const scene = initOcean(document.querySelector('#ocean'));
const track = document.querySelector('.dive-track');
const hero = document.querySelector('.hero');
const heroCopy = document.querySelector('.hero-copy');
const deepMessage = document.querySelector('.deep-message');
let paused = motionPreference.matches;
let framePending = false;
let currentProgress = 0;
const depthNumber = document.querySelector('#depth-number');
const depthLabel = document.querySelector('.depth-label');

function syncScroll() {
  framePending = false;
  const y = window.scrollY;
  const max = Math.max(1, track.offsetHeight - hero.offsetHeight);
  currentProgress = Math.max(0, Math.min(1, y / max));
  root.style.setProperty('--dive', currentProgress.toFixed(4));
  root.style.setProperty('--depth', Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4));
  if (motionPreference.matches && paused) scene.progress = currentProgress;
  scene.setProgress(currentProgress);
  depthNumber.textContent = String(Math.min(999, Math.round(y / innerHeight * 12))).padStart(3, '0');
  depthLabel.textContent = currentProgress < .35 ? 'SURFACE' : currentProgress < .9 ? 'DIVING' : 'DEEP BLUE';
  const heroHidden = currentProgress >= .435;
  heroCopy.inert = heroHidden;
  heroCopy.style.visibility = heroHidden ? 'hidden' : 'visible';
  deepMessage.setAttribute('aria-hidden', String(currentProgress <= .62));
}
addEventListener('scroll', () => { if (!framePending) { framePending = true; requestAnimationFrame(syncScroll); } }, {passive:true});
addEventListener('resize', syncScroll, {passive:true});
addEventListener('pointermove', e => {
  if (!paused) scene.setPointer((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2);
}, {passive:true});
document.querySelector('#dive').addEventListener('click', () => scrollTo({top:track.offsetHeight - hero.offsetHeight, behavior:motionPreference.matches?'instant':'smooth'}));

function updateMotion() {
  // An explicit play action may override the initial system preference.
  scene.reducedMotion = paused;
  scene.setPaused(paused);
  document.body.classList.toggle('motion-paused', paused);
  const button = document.querySelector('#motion');
  button.setAttribute('aria-pressed', String(paused));
  button.setAttribute('aria-label', paused?'播放海面动效':'暂停海面动效');
  button.querySelector('.pause-icon').textContent = paused ? '▷' : 'Ⅱ';
  button.querySelector('.motion-label').textContent = paused ? '播放动效' : '暂停动效';
}
document.querySelector('#motion').addEventListener('click', () => {paused = !paused; updateMotion();});
motionPreference.addEventListener('change', event => {
  paused = event.matches;
  updateMotion();
  syncScroll();
});
updateMotion();
syncScroll();

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {entry.target.classList.add('visible');observer.unobserve(entry.target);}
}), {threshold:.08});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Ocean ambience is synthesized locally. Audio starts only after an explicit click.
let audioContext, masterGain, soundOn = false;
function createOceanSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Audio unavailable');
  audioContext = new AudioCtx();
  const buffer = audioContext.createBuffer(2, audioContext.sampleRate * 9, audioContext.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < data.length; i++) {last = (last + (Math.random()*2-1)*.035)/1.02;data[i]=last*3.5;}
  }
  const source = audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
  const filter = audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1200;
  const swell = audioContext.createGain();swell.gain.value=.5;
  const lfo = audioContext.createOscillator();lfo.type='sine';lfo.frequency.value=.105;
  const lfoGain = audioContext.createGain();lfoGain.gain.value=.22;
  lfo.connect(lfoGain);lfoGain.connect(swell.gain);
  masterGain=audioContext.createGain();masterGain.gain.value=0;
  source.connect(filter);filter.connect(swell);swell.connect(masterGain);masterGain.connect(audioContext.destination);
  source.start();lfo.start();
}
document.querySelector('#sound').addEventListener('click', async () => {
  try {
    if (!audioContext) createOceanSound();
    await audioContext.resume();soundOn=!soundOn;
    masterGain.gain.setTargetAtTime(soundOn?.65:0,audioContext.currentTime,.45);
    const button=document.querySelector('#sound');button.setAttribute('aria-pressed',String(soundOn));
    button.setAttribute('aria-label',soundOn?'关闭海浪环境音':'开启海浪环境音');
    button.querySelector('b').textContent=soundOn?'开':'关';
  } catch {toast('当前浏览器暂不支持环境音');}
});
document.addEventListener('visibilitychange', () => {
  if(audioContext) {if(document.hidden) audioContext.suspend(); else if(soundOn) audioContext.resume();}
});

const projects = {
  tide:{kicker:'01 / INTERACTIVE EXPERIENCE',title:'TIDE · 沉浸式个人空间',description:'把一次浏览变成一段缓慢的下潜。海浪由实时渲染生成，镜头跟随滚动从日落海面进入深蓝水下；文字、光线和内容随着深度逐渐展开。这是一个关于数字空间与情绪的概念练习，也是你正在浏览的这个首页。',tags:['交互设计','实时海面','滚动叙事']},
  still:{kicker:'02 / VISUAL EXPLORATION',title:'STILL · 日常观察',description:'以光、几何和材质为线索，寻找日常里的片刻安静。一束光的移动、一面墙的阴影，都可以成为视觉语言的起点。这组概念画面探索克制的配色、空间关系与留白。',tags:['视觉实验','光影构成','色彩研究']}
};
const projectDialog = document.querySelector('#project-dialog');
const dialogOpeners = new WeakMap();
let previousOverflow = '';
function openDialog(dialog, opener) {
  dialogOpeners.set(dialog, opener);
  previousOverflow = document.body.style.overflow;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}
function closeDialog(dialog) {dialog.close();}
document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{
  const item=projects[button.dataset.project];
  document.querySelector('#dialog-kicker').textContent=item.kicker;
  document.querySelector('#dialog-title').textContent=item.title;
  document.querySelector('#dialog-description').textContent=item.description;
  document.querySelector('#dialog-art').replaceChildren(button.querySelector('.project-art').cloneNode(true));
  document.querySelector('#dialog-tags').replaceChildren(...item.tags.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
  openDialog(projectDialog,button);
}));
document.querySelectorAll('dialog').forEach(dialog=>{
  const title = dialog.querySelector('h2');
  const description = dialog.querySelector('p:not(.eyebrow)');
  title.id ||= `${dialog.id}-title`;
  description.id ||= `${dialog.id}-description`;
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.setAttribute('aria-describedby', description.id);
  dialog.querySelector('.dialog-close').addEventListener('click',()=>closeDialog(dialog));
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});
  dialog.addEventListener('close',()=>{
    document.body.style.overflow = previousOverflow;
    dialogOpeners.get(dialog)?.focus({preventScroll:true});
  });
});
document.querySelector('.dialog-done').addEventListener('click',()=>closeDialog(projectDialog));
let savedEmail='';try{savedEmail=localStorage.getItem('tide-contact-email')||'';}catch{}
document.querySelector('#hello').addEventListener('click',e=>{
  const email=profile.email||savedEmail;
  if(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('你好，TIDE')}`;}
  else {
    document.querySelector('#contact-email').value = savedEmail;
    openDialog(document.querySelector('#hello-dialog'),e.currentTarget);
  }
});
document.querySelector('#email-form').addEventListener('submit',e=>{
  e.preventDefault();savedEmail=document.querySelector('#contact-email').value.trim();
  try{localStorage.setItem('tide-contact-email',savedEmail);toast('邮箱已保存到当前浏览器');}catch{toast('邮箱已在本次访问中生效');}
  closeDialog(document.querySelector('#hello-dialog'));
});
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
window.addEventListener('pagehide',()=>scene.setPaused(true));
window.addEventListener('pageshow',()=>updateMotion());
