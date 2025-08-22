// ===== Firebase 設定 =====
const firebaseConfig = {
  apiKey: "AIzaSyAGLuyHZSLolwy9L5jIiX_5U_UxgjGpR4A",
  authDomain: "quizgamedatabase-e9882.firebaseapp.com",
  projectId: "quizgamedatabase-e9882",
  storageBucket: "quizgamedatabase-e9882.firebasestorage.app",
  messagingSenderId: "877960579102",
  appId: "1:877960579102:web:29f012f5ff029bb53b860f",
  measurementId: "G-RDTQCGLBCN"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== DOM & 狀態變數 =====
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

// ===== Modal 密碼 =====
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
    passwordResolve=resolve;
  });
}

function hidePasswordModal(){ passwordModal.style.display="none"; }

passwordConfirmBtn.addEventListener('click',()=>{ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); });
passwordCancelBtn.addEventListener('click',()=>{ if(passwordResolve) passwordResolve('CANCELLED'); hidePasswordModal(); });
passwordInput.addEventListener('keydown', e=>{ if(e.key==="Enter"){ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); }});

// ===== Section 切換 =====
function showSection(name){ Object.values(sections).forEach(s=>s.classList.remove('active')); sections[name].classList.add('active'); }

// ===== 主選單按鈕 =====
document.getElementById('goToQuiz').addEventListener('click', async ()=>{
  const pwd = await showPasswordModal("輸入玩家密碼");
  if(pwd==='CANCELLED'){alert("已取消"); return;}
  if(pwd!==PLAYER_PASSWORD){alert("玩家密碼錯誤"); return;}
  showSection('quiz');
});

document.getElementById('goToQuestionManage').addEventListener('click', async ()=>{
  if(!adminVerified){
    const pwd = await showPasswordModal("輸入管理員密碼");
    if(pwd==='CANCELLED'){alert("已取消"); return;}
    if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
    adminVerified=true;
  }
  showSection('questionManage');
});

document.getElementById('goToLeaderboard').addEventListener('click', ()=>{ showSection('leaderboard'); });
document.querySelectorAll('.backBtn').forEach(btn=>btn.addEventListener('click',()=>{ showSection(btn.dataset.back); }));

// ===== Firebase 連線檢查 =====
async function checkFirebaseConnection(){
  try{
    const testDoc = db.collection('questions').limit(1);
    await testDoc.get();
    console.log('Firebase 已連線');
  }catch(err){
    console.error(err);
  }
}

// ===== 題目管理 =====
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
      <td><button class="btn danger" data-id="${q.id}">刪除</button></td>`;
    questionTableBody.appendChild(tr);

    // 可展開題目
    const tdQ = tr.querySelector('.expandable');
    tdQ.addEventListener('click', ()=>{ tdQ.style.whiteSpace = (tdQ.style.whiteSpace==='normal'?'nowrap':'normal'); });

    // 刪除單題
    tr.querySelector('button').addEventListener('click', async ()=>{
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

// 新增題目按鈕功能修正
addQuestionBtn.addEventListener('click', async ()=>{
  const q = document.getElementById('newQuestion').value.trim();
  const A = document.getElementById('optionA').value.trim();
  const B = document.getElementById('optionB').value.trim();
  const C = document.getElementById('optionC').value.trim();
  const D = document.getElementById('optionD').value.trim();
  let correct = document.getElementById('correctOption').value.trim().toUpperCase();

  if(!q||!A||!B||!C||!D||!correct){ alert('請填寫完整題目及選項'); return;}
  if(!['A','B','C','D'].includes(correct)){ alert('正確答案請輸入 A/B/C/D'); return;}
  if(questions.some(item=>item.q===q)){ alert('題目重複'); return;}

  await db.collection('questions').add({q,A,B,C,D,correct});
  alert('題目新增成功');
  document.getElementById('newQuestion').value='';
  document.getElementById('optionA').value='';
  document.getElementById('optionB').value='';
  document.getElementById('optionC').value='';
  document.getElementById('optionD').value='';
  document.getElementById('correctOption').value='';
  fetchQuestionsFromFirestore();
});

// ===== 問答遊戲及排行榜程式碼保持原樣，只需在 renderLeaderboard 加上前三名顏色 =====
const leaderboardTableBody = document.querySelector('#leaderboardTable tbody');

function renderLeaderboard(){
  leaderboardTableBody.innerHTML='';
  leaderboard.sort((a,b)=>{
    if(b.score!==a.score) return b.score - a.score;
    return a.time - b.time;
  });

  leaderboard.forEach((p,i)=>{
    const tr=document.createElement('tr');
    let rankClass='';
    if(i===0) rankClass='gold';
    else if(i===1) rankClass='silver';
    else if(i===2) rankClass='bronze';

    tr.innerHTML = `<td class="${rankClass}">${i+1}</td>
      <td class="expandable ${rankClass}">${p.name}</td>
      <td class="${rankClass}">${p.score}</td>
      <td class="${rankClass}">${Math.round(p.time/1000)} 秒</td>
      <td><button class="btn danger" data-index="${i}">刪除</button></td>`;
    leaderboardTableBody.appendChild(tr);

    // 可展開玩家名稱
    tr.querySelector('.expandable').addEventListener('click', ()=>{
      tr.querySelector('.expandable').style.whiteSpace = (tr.querySelector('.expandable').style.whiteSpace==='normal'?'nowrap':'normal');
    });

    // 刪除單筆排行榜
    tr.querySelector('button').addEventListener('click', async ()=>{
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消"); return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
      leaderboard.splice(parseInt(tr.querySelector('button').dataset.index),1);
      const snapshot = await db.collection('leaderboard').get();
      const docId = snapshot.docs[parseInt(tr.querySelector('button').dataset.index)].id;
      await db.collection('leaderboard').doc(docId).delete();
      renderLeaderboard();
    });
  });
}

// Firebase 即時更新排行榜
db.collection('leaderboard').onSnapshot(snapshot=>{
  leaderboard=[];
  snapshot.forEach(doc=>leaderboard.push({...doc.data(), id: doc.id}));
  renderLeaderboard();
});

// 初始載入題目
fetchQuestionsFromFirestore();
