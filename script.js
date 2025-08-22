// ===== Firebase 初始化 =====
// 這裡請把 firebaseConfig 換成你自己的
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

// ===== DOM & 狀態變數 =====
const sections = {
  menu: document.getElementById('menu'),
  quiz: document.getElementById('quiz'),
  questionManage: document.getElementById('questionManage'),
  leaderboard: document.getElementById('leaderboard')
};
const PLAYER_PASSWORD = "player123";  // 玩家密碼，可在程式改
const ADMIN_PASSWORD = "admin123";    // 管理員密碼，可在程式改
let adminVerified = false;
let questions = [], leaderboard = [];
let playerName = '', currentQuestionIndex = 0, playerScore = 0, selectedAnswer = null;

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

// ===== 主選單 =====
document.getElementById('goToQuiz').addEventListener('click', async ()=>{
  const pwd=await showPasswordModal("輸入玩家密碼");
  if(pwd==='CANCELLED'){alert("已取消"); return;}
  if(pwd!==PLAYER_PASSWORD){alert("玩家密碼錯誤"); return;}
  showSection('quiz');
});
document.getElementById('goToQuestionManage').addEventListener('click', async ()=>{
  if(!adminVerified){
    const pwd=await showPasswordModal("輸入管理員密碼");
    if(pwd==='CANCELLED'){alert("已取消"); return;}
    if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
    adminVerified=true;
  }
  showSection('questionManage');
});
document.getElementById('goToLeaderboard').addEventListener('click', ()=>{ showSection('leaderboard'); });
document.querySelectorAll('.backBtn').forEach(btn=>btn.addEventListener('click',()=>{ showSection(btn.dataset.back); }));

// ===== 題目 Firestore =====
function fetchQuestionsFromFirestore(){
  db.collection("questions").get().then(snapshot=>{
    questions=[];
    snapshot.forEach(doc=>questions.push(doc.data()));
    renderQuestionTable();
  });
}
function addQuestionToFirestore(qObj){ return db.collection("questions").add(qObj); }
function deleteQuestionFromFirestore(index){
  return db.collection("questions").get().then(snapshot=>{
    const docToDelete=snapshot.docs[index];
    if(docToDelete) return db.collection("questions").doc(docToDelete.id).delete();
  });
}

// ===== 題目表格渲染 =====
function renderQuestionTable(){
  const tbody=document.querySelector('#questionTable tbody');
  tbody.innerHTML='';
  questions.forEach((q,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="expandable">${q.q}</td><td>${q.A}</td><td>${q.B}</td><td>${q.C}</td><td>${q.D}</td><td>${q.correct}</td>
    <td><button class="btn danger" data-index="${i}">刪除</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('.expandable').addEventListener('click',()=>{ tr.querySelector('.expandable').style.whiteSpace=(tr.querySelector('.expandable').style.whiteSpace==='normal'?'nowrap':'normal'); });
  });
  tbody.querySelectorAll('button').forEach(btn=>btn.addEventListener('click', async e=>{
    if(!adminVerified){
      const pwd=await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消"); return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
      adminVerified=true;
    }
    if(confirm("確定要刪除這題嗎？")){
      await deleteQuestionFromFirestore(parseInt(e.currentTarget.dataset.index));
      fetchQuestionsFromFirestore();
    }
  }));
}

// ===== CSV 匯入/匯出 =====
const importCSV=document.getElementById('importCSV');
document.getElementById('importBtn').addEventListener('click',async ()=>{
  if(!importCSV.files.length){alert('請選擇 CSV'); return;}
  const file=importCSV.files[0]; const reader=new FileReader();
  reader.onload=async e=>{
    let lines=e.target.result.split(/\r?\n/).filter(l=>l.trim()!==''); let addedCount=0;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(s=>s.trim()); if(cols.length<6) continue;
      let [q,A,B,C,D,correct]=cols; if(!q||!A||!B||!C||!D||!correct) continue;
      correct=correct.toUpperCase().trim().replace(/[\r\n]+/g,'');
      if(questions.some(item=>item.q===q)) continue;
      await addQuestionToFirestore({q,A,B,C,D,correct}); addedCount++;
    }
    alert(`匯入完成，共新增 ${addedCount} 題`);
    fetchQuestionsFromFirestore();
  };
  reader.readAsText(file,'UTF-8');
});
document.getElementById('exportCSVBtn').addEventListener('click', async ()=>{
  const snapshot=await db.collection("questions").get();
  const questionsData=[]; snapshot.forEach(doc=>questionsData.push(doc.data()));
  const header='\uFEFF題目,A,B,C,D,正確答案\n';
  const body=questionsData.map(q=>`${q.q},${q.A},${q.B},${q.C},${q.D},${q.correct}`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='questions.csv'; a.click(); URL.revokeObjectURL(url);
});

// ===== 問答遊戲 =====
const playerNameInput=document.getElementById('playerName');
const startQuizBtn=document.getElementById('startQuizBtn');
const quizArea=document.getElementById('quizArea');
const quizResult=document.getElementById('quizResult');
const questionText=document.getElementById('questionText');
const optionsContainer=document.getElementById('optionsContainer');
const confirmAnswerBtn=document.getElementById('confirmAnswerBtn');
const playerSetup=document.getElementById('playerSetup');

function renderQuestion(q){
  questionText.textContent=q.q;
  optionsContainer.innerHTML='';
  ['A','B','C','D'].forEach(letter=>{
    const btn=document.createElement('button'); btn.textContent=`${letter}: ${q[letter]}`; btn.className='optionBtn';
    btn.addEventListener('click',()=>{ selectedAnswer=letter; document.querySelectorAll('.optionBtn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); confirmAnswerBtn.disabled=false; });
    optionsContainer.appendChild(btn);
  });
}

// 玩家名稱檢查
function validatePlayerName(name){
  if(/[^\u4e00-\u9fa5A-Za-z0-9_]/.test(name)) return "名稱有特殊字元";
  if(name.length>16) return "超過16個字元";
  return null;
}

startQuizBtn.addEventListener('click',()=>{
  playerName=playerNameInput.value.trim();
  const error=validatePlayerName(playerName);
  if(error){alert(error); return;}
  if(leaderboard.some(l=>l.name===playerName)){alert('名稱重複'); return;}
  playerSetup.style.display='none'; quizArea.style.display='block'; quizResult.style.display='none';
  currentQuestionIndex=0; playerScore=0; selectedAnswer=null;
  renderQuestion(questions[currentQuestionIndex]);
});

confirmAnswerBtn.addEventListener('click', async ()=>{
  const correct=questions[currentQuestionIndex].correct;
  if(selectedAnswer===correct) playerScore++;
  currentQuestionIndex++;
  if(currentQuestionIndex>=questions.length){
    quizArea.style.display='none'; quizResult.style.display='block';
    quizResult.textContent=`${playerName} 得分：${playerScore}`;
    // ===== 將成績加入 Firestore =====
    await db.collection("leaderboard").add({name:playerName,score:playerScore});
    fetchLeaderboardFromFirestore();
  } else { selectedAnswer=null; confirmAnswerBtn.disabled=true; renderQuestion(questions[currentQuestionIndex]); }
});

// ===== 排行榜 =====
const leaderboardTableBody=document.querySelector('#leaderboardTable tbody');

function fetchLeaderboardFromFirestore(){
  db.collection("leaderboard").orderBy("score","desc").get().then(snapshot=>{
    leaderboard=[];
    snapshot.forEach(doc=>leaderboard.push({id:doc.id, ...doc.data()}));
    renderLeaderboard();
  });
}

function renderLeaderboard(){
  leaderboardTableBody.innerHTML='';
  leaderboard.forEach((p,i)=>{
    const tr=document.createElement('tr');
    let bgColor='', textColor='#000';
    if(i===0){bgColor='#FFD700'; textColor='#000';}  // 金
    else if(i===1){bgColor='#C0C0C0'; textColor='#000';} // 銀
    else if(i===2){bgColor='#CD7F32'; textColor='#fff';} // 銅
    tr.innerHTML=`<td>${i+1}</td><td class="expandable">${p.name}</td><td>${p.score}</td>
    <td><button class="btn danger" data-id="${p.id}">刪除</button></td>`;
    tr.style.backgroundColor=bgColor;
    tr.style.color=textColor;
    leaderboardTableBody.appendChild(tr);
    tr.querySelector('.expandable').addEventListener('click',()=>{ tr.querySelector('.expandable').style.whiteSpace=(tr.querySelector('.expandable').style.whiteSpace==='normal'?'nowrap':'normal'); });
  });
  // 刪除單筆成績
  leaderboardTableBody.querySelectorAll('button').forEach(btn=>btn.addEventListener('click', async e=>{
    if(!adminVerified){
      const pwd=await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消"); return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
      adminVerified=true;
    }
    if(confirm("確定刪除此筆成績嗎？")){
      const docId=e.currentTarget.dataset.id;
      await db.collection("leaderboard").doc(docId).delete();
      fetchLeaderboardFromFirestore();
    }
  }));
}

// 一鍵刪除所有排行榜
document.getElementById('clearLeaderboardBtn')?.addEventListener('click', async ()=>{
  if(!adminVerified){
    const pwd=await showPasswordModal("輸入管理員密碼");
    if(pwd==='CANCELLED'){alert("已取消"); return;}
    if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤"); return;}
    adminVerified=true;
  }
  if(confirm("確定要刪除所有排行榜成績嗎？")){
    const snapshot=await db.collection("leaderboard").get();
    const batch=db.batch();
    snapshot.forEach(doc=>batch.delete(doc.ref));
    await batch.commit();
    fetchLeaderboardFromFirestore();
  }
});

// ===== 初始化 =====
fetchQuestionsFromFirestore();
fetchLeaderboardFromFirestore();
