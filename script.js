// ==========================
// ======== Firebase 初始化 ========
const firebaseConfig = {
  apiKey: "AIzaSyAGLuyHZSLolwy9L5jIiX_5U_UxgjGpR4A",
  authDomain: "quizgamedatabase-e9882.firebaseapp.com",
  projectId: "quizgamedatabase-e9882",
  storageBucket: "quizgamedatabase-e9882.appspot.com",
  messagingSenderId: "877960579102",
  appId: "1:877960579102:web:29f012f5ff029bb53b860f",
  measurementId: "G-RDTQCGLBCN"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================
// ======== DOM & 狀態變數 ========
const sections = {
  menu: document.getElementById('menu'),
  quiz: document.getElementById('quiz'),
  questionManage: document.getElementById('questionManage'),
  leaderboard: document.getElementById('leaderboard')
};

const PLAYER_PASSWORD = "player123";
const ADMIN_PASSWORD = "admin123";
let adminVerified = false;

let questions = [];
let leaderboard = [];
let playerName = '', currentQuestionIndex = 0, playerScore = 0, selectedAnswer = null, startTime = 0;

// ==========================
// ======== 主選單 Firebase 連線狀態 ========
const connectionStatus = document.createElement('div');
connectionStatus.style.marginTop = '12px';
connectionStatus.style.fontSize = '0.9rem';
connectionStatus.style.textAlign = 'center';
connectionStatus.textContent = '資料庫連線狀態：檢查中...';
document.getElementById('menu').appendChild(connectionStatus);

const refreshBtn = document.getElementById('refreshConnection');

async function checkFirebaseConnection(){
  try{
    const test = await db.collection('questions').limit(1).get();
    connectionStatus.textContent = '資料庫連線狀態：已連線';
  }catch(err){
    console.error(err);
    connectionStatus.textContent = '資料庫連線狀態：無法連線';
  }
}
checkFirebaseConnection();
refreshBtn.addEventListener('click', async ()=>{
  const pwd = await showPasswordModal("輸入管理員密碼確認");
  if(pwd==='CANCELLED'){ alert("已取消"); return; }
  if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
  checkFirebaseConnection();
});

// ==========================
// ======== Modal 密碼 ========
const passwordModal = document.getElementById('passwordModal');
const modalTitle = document.getElementById('modalTitle');
const passwordInput = document.getElementById('passwordInput');
const passwordConfirmBtn = document.getElementById('passwordConfirmBtn');
const passwordCancelBtn = document.getElementById('passwordCancelBtn');
let passwordResolve = null;

function showPasswordModal(title){
  return new Promise(resolve=>{
    modalTitle.textContent = title;
    passwordInput.value="";
    passwordModal.style.display="flex";
    passwordInput.focus();
    passwordResolve = resolve;
  });
}
function hidePasswordModal(){ passwordModal.style.display="none"; }

passwordConfirmBtn.addEventListener('click', ()=>{ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); });
passwordCancelBtn.addEventListener('click', ()=>{ if(passwordResolve) passwordResolve('CANCELLED'); hidePasswordModal(); });
passwordInput.addEventListener('keydown', e=>{ if(e.key==="Enter"){ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); }});

// ==========================
// ======== 畫面切換 ========
function showSection(name){
  Object.values(sections).forEach(s=>s.classList.remove('active'));
  sections[name].classList.add('active');
}

// ==========================
// ======== 主選單按鈕 ========
document.addEventListener('DOMContentLoaded', () => {
  const goToQuizBtn = document.getElementById("goToQuiz");
  const goToQuestionManageBtn = document.getElementById("goToQuestionManage");
  const goToLeaderboardBtn = document.getElementById("goToLeaderboard");

  if(goToQuizBtn) goToQuizBtn.addEventListener("click", async ()=>{
    const pwd = await showPasswordModal("輸入玩家密碼");
    if(pwd==='CANCELLED'){ alert("已取消"); return; }
    if(pwd!==PLAYER_PASSWORD){ alert("玩家密碼錯誤"); return; }
    showSection('quiz');
  });

  if(goToQuestionManageBtn) goToQuestionManageBtn.addEventListener("click", async ()=>{
    if(!adminVerified){
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){ alert("已取消"); return; }
      if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
      adminVerified = true;
    }
    showSection('questionManage');
    fetchQuestionsFromFirestore();
  });

  if(goToLeaderboardBtn) goToLeaderboardBtn.addEventListener("click", ()=>{ showSection('leaderboard'); });

  document.querySelectorAll('.backBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ showSection(btn.dataset.back || 'menu'); });
  });
});

// ==========================
// ======== 題目管理 ========
const addQuestionBtn = document.getElementById('addQuestionBtn');
const importCSV = document.getElementById('importCSV');
const importBtn = document.getElementById('importBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const questionTableBody = document.querySelector('#questionTable tbody');

async function fetchQuestionsFromFirestore(){
  questions=[];
  const snapshot = await db.collection('questions').get();
  snapshot.forEach(doc=>questions.push({...doc.data(), id: doc.id}));
  renderQuestionTable();
}

function renderQuestionTable(){
  questionTableBody.innerHTML='';
  questions.forEach((q,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="expandable">${q.q}</td><td>${q.A}</td><td>${q.B}</td><td>${q.C}</td><td>${q.D}</td><td>${q.correct}</td>
      <td><button class="deleteBtn" data-id="${q.id}">刪除</button></td>`;
    questionTableBody.appendChild(tr);

    // 展開題目
    const tdQ = tr.querySelector('.expandable');
    tdQ.addEventListener('click', ()=>{ tdQ.style.whiteSpace = (tdQ.style.whiteSpace==='normal'?'nowrap':'normal'); });

    // 刪除單題
    tr.querySelector('.deleteBtn').addEventListener('click', async ()=>{
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消"); return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
      if(confirm("確定要刪除這題嗎？")){
        await db.collection('questions').doc(q.id).delete();
        fetchQuestionsFromFirestore();
      }
    });
  });
}

// 新增題目
addQuestionBtn.addEventListener('click', async ()=>{
  const q = document.getElementById('newQuestion').value.trim();
  const A = document.getElementById('optionA').value.trim();
  const B = document.getElementById('optionB').value.trim();
  const C = document.getElementById('optionC').value.trim();
  const D = document.getElementById('optionD').value.trim();
  let correct = document.getElementById('correctOption').value.trim().toUpperCase();
  if(!q||!A||!B||!C||!D||!correct){ alert("請填寫完整題目與選項"); return;}
  if(!['A','B','C','D'].includes(correct)){ alert("正確答案請輸入 A~D"); return;}
  await db.collection('questions').add({q,A,B,C,D,correct});
  fetchQuestionsFromFirestore();
  document.getElementById('newQuestion').value='';
  document.getElementById('optionA').value='';
  document.getElementById('optionB').value='';
  document.getElementById('optionC').value='';
  document.getElementById('optionD').value='';
  document.getElementById('correctOption').value='';
});

// CSV 匯入
importBtn.addEventListener('click', async ()=>{
  if(!importCSV.files.length){alert('請選擇 CSV'); return;}
  const file = importCSV.files[0];
  const reader = new FileReader();
  reader.onload = async e=>{
    let lines = e.target.result.split(/\r?\n/).filter(l=>l.trim()!==''), addedCount=0;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(s=>s.trim()); if(cols.length<6) continue;
      let [q,A,B,C,D,correct]=cols; if(!q||!A||!B||!C||!D||!correct) continue;
      correct=correct.toUpperCase().trim();
      if(questions.some(item=>item.q===q)) continue;
      await db.collection('questions').add({q,A,B,C,D,correct});
      addedCount++;
    }
    alert(`匯入完成，共新增 ${addedCount} 題`);
    fetchQuestionsFromFirestore();
  };
  reader.readAsText(file,'UTF-8');
});

// CSV 匯出
exportCSVBtn.addEventListener('click', async ()=>{
  const snapshot = await db.collection('questions').get();
  const header='\uFEFF題目,A,B,C,D,正確答案\n';
  const body = snapshot.docs.map(doc=>`${doc.data().q},${doc.data().A},${doc.data().B},${doc.data().C},${doc.data().D},${doc.data().correct}`).join('\n');
  const blob = new Blob([header+body], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='questions.csv'; a.click(); URL.revokeObjectURL(url);
});

// ==========================
// ======== 問答遊戲 ========
const playerNameInput = document.getElementById('playerName');
const startQuizBtn = document.getElementById('startQuizBtn');
const playerSetup = document.getElementById('playerSetup');
const quizArea = document.getElementById('quizArea');
const quizResult = document.getElementById('quizResult');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const confirmAnswerBtn = document.getElementById('confirmAnswerBtn');

startQuizBtn.addEventListener('click', ()=>{
  playerName = playerNameInput.value.trim();
  if(playerName.match(/[^A-Za-z0-9_\u4e00-\u9fa5]/)) { alert("名稱有特殊字元"); return; }
  if(playerName.length>16) { alert("超過16個字元"); return; }
  if(leaderboard.some(l=>l.name===playerName)) { alert("名稱重複"); return; }

  playerSetup.style.display = 'none';
  quizArea.style.display='block';
  quizResult.style.display='none';
  currentQuestionIndex = 0;
  playerScore = 0;
  selectedAnswer = null;
  startTime = Date.now();
  renderQuestion(questions[currentQuestionIndex]);
});

function renderQuestion(q){
  questionText.textContent=q.q;
  optionsContainer.innerHTML='';
  ['A','B','C','D'].forEach(letter=>{
    const btn = document.createElement('button');
    btn.textContent = `${letter}: ${q[letter]}`;
    btn.className = 'optionBtn';
    btn.addEventListener('click', ()=>{
      selectedAnswer = letter;
      document.querySelectorAll('.optionBtn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      confirmAnswerBtn.disabled=false;
    });
    optionsContainer.appendChild(btn);
  });
}

confirmAnswerBtn.addEventListener('click', ()=>{
  const correct = questions[currentQuestionIndex].correct;
  if(selectedAnswer===correct) playerScore++;
  currentQuestionIndex++;
  if(currentQuestionIndex>=questions.length){
    quizArea.style.display='none';
    quizResult.style.display='block';
    quizResult.textContent = `${playerName} 得分：${playerScore}，用時 ${Math.round((Date.now()-startTime)/1000)} 秒`;
    leaderboard.push({name:playerName, score:playerScore, time: Date.now()-startTime});
    db.collection('leaderboard').add({name:playerName, score:playerScore, time: Date.now()-startTime});
    renderLeaderboard();
  } else {
    selectedAnswer=null; confirmAnswerBtn.disabled=true;
    renderQuestion(questions[currentQuestionIndex]);
  }
});

// ==========================
// ======== 排行榜 ========
const leaderboardTableBody = document.querySelector('#leaderboardTable tbody');
const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');

function renderLeaderboard(){
  leaderboardTableBody.innerHTML='';
  leaderboard.sort((a,b)=>{
    if(b.score!==a.score) return b.score - a.score;
    return a.time - b.time;
  });

  leaderboard.forEach((p,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td class="expandable">${p.name}</td><td>${p.score}</td><td>${Math.round(p.time/1000)} 秒</td><td><button class="deleteBtn" data-index="${i}">刪除</button></td>`;
    if(i===0) tr.classList.add('gold');
    else if(i===1) tr.classList.add('silver');
    else if(i===2) tr.classList.add('bronze');
    leaderboardTableBody.appendChild(tr);

    // 展開玩家名稱
    tr.querySelector('.expandable').addEventListener('click', ()=>{
      const td = tr.querySelector('.expandable');
      td.style.whiteSpace = (td.style.whiteSpace==='normal'?'nowrap':'normal');
    });

    tr.querySelector('.deleteBtn').addEventListener('click', async ()=>{
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消"); return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
      const snapshot = await db.collection('leaderboard').get();
      const docId = snapshot.docs[parseInt(tr.querySelector('.deleteBtn').dataset.index)].id;
      await db.collection('leaderboard').doc(docId).delete();
    });
  });
}

// 一鍵刪除排行榜
clearLeaderboardBtn.addEventListener('click', async ()=>{
  const pwd = await showPasswordModal("輸入管理員密碼");
  if(pwd==='CANCELLED'){alert("已取消"); return;}
  if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
  const snapshot = await db.collection('leaderboard').get();
  for(const doc of snapshot.docs){
    await db.collection('leaderboard').doc(doc.id).delete();
  }
});

// Firebase 即時更新排行榜
db.collection('leaderboard').onSnapshot(snapshot=>{
  leaderboard=[];
  snapshot.forEach(doc=>leaderboard.push({...doc.data(), id:doc.id}));
  renderLeaderboard();
});

// ==========================
// ======== 初始題目載入 ========
fetchQuestionsFromFirestore();
