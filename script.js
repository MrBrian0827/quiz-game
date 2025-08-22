// ===== Firebase 初始化 =====
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

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM & 狀態 =====
  const sections = {
    menu: document.getElementById('menu'),
    quiz: document.getElementById('quiz'),
    questionManage: document.getElementById('questionManage'),
    leaderboard: document.getElementById('leaderboard')
  };
  const PLAYER_PASSWORD = "player123"; // 可直接在程式修改
  const ADMIN_PASSWORD = "admin123";   // 可直接在程式修改
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
    const pwd = await showPasswordModal("輸入玩家密碼");
    if(pwd==='CANCELLED'){alert("已取消");return;}
    if(pwd!==PLAYER_PASSWORD){alert("玩家密碼錯誤");return;}
    showSection('quiz');
  });
  document.getElementById('goToQuestionManage').addEventListener('click', async ()=>{
    if(!adminVerified){
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消");return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤");return;}
      adminVerified = true;
    }
    showSection('questionManage');
  });
  document.getElementById('goToLeaderboard').addEventListener('click',()=>{ showSection('leaderboard'); });
  document.querySelectorAll('.backBtn').forEach(btn=>btn.addEventListener('click',()=>{ showSection(btn.dataset.back); }));

  // ===== 題庫 Firestore =====
  async function fetchQuestions(){ 
    questions=[]; 
    const snapshot = await db.collection("questions").get();
    snapshot.forEach(doc => questions.push(doc.data())); 
    renderQuestionTable();
  }
  async function addQuestion(qObj){ await db.collection("questions").add(qObj); }
  async function deleteQuestion(index){
    const snapshot = await db.collection("questions").get();
    const docToDelete = snapshot.docs[index];
    if(docToDelete) await db.collection("questions").doc(docToDelete.id).delete();
  }

  function renderQuestionTable(){
    const tbody = document.querySelector('#questionTable tbody');
    tbody.innerHTML = '';
    questions.forEach((q,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="expandable">${q.q}</td><td>${q.A}</td><td>${q.B}</td><td>${q.C}</td><td>${q.D}</td><td>${q.correct}</td>
      <td><button class="btn danger" data-index="${i}">刪除</button></td>`;
      tbody.appendChild(tr);
      tr.querySelector('.expandable').addEventListener('click',()=>{ tr.querySelector('.expandable').style.whiteSpace = (tr.querySelector('.expandable').style.whiteSpace==='normal'?'nowrap':'normal'); });
    });
    tbody.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', async e=>{
        if(!adminVerified){
          const pwd = await showPasswordModal("輸入管理員密碼");
          if(pwd==='CANCELLED'){alert("已取消");return;}
          if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤");return;}
          adminVerified = true;
        }
        if(confirm("確定要刪除這題嗎？")){
          await deleteQuestion(parseInt(e.currentTarget.dataset.index));
          fetchQuestions();
        }
      });
    });
  }

  // ===== CSV 匯入/匯出 =====
  const importCSV = document.getElementById('importCSV');
  document.getElementById('importBtn').addEventListener('click', async ()=>{
    if(!importCSV.files.length){alert('請選擇 CSV');return;}
    const file = importCSV.files[0];
    const reader = new FileReader();
    reader.onload = async e=>{
      let lines = e.target.result.split(/\r?\n/).filter(l=>l.trim()!==''); let addedCount = 0;
      for(let i=1;i<lines.length;i++){
        const cols = lines[i].split(',').map(s=>s.trim()); if(cols.length<6) continue;
        let [q,A,B,C,D,correct] = cols; if(!q||!A||!B||!C||!D||!correct) continue;
        correct = correct.toUpperCase().trim().replace(/[\r\n]+/g,'');
        if(questions.some(item=>item.q===q)) continue;
        await addQuestion({q,A,B,C,D,correct}); addedCount++;
      }
      alert(`匯入完成，共新增 ${addedCount} 題`);
      fetchQuestions();
    };
    reader.readAsText(file,'UTF-8');
  });
  document.getElementById('exportCSVBtn').addEventListener('click', async ()=>{
    const snapshot = await db.collection("questions").get();
    const questionsData = [];
    snapshot.forEach(doc=>questionsData.push(doc.data()));
    const header='\uFEFF題目,A,B,C,D,正確答案\n';
    const body = questionsData.map(q=>`${q.q},${q.A},${q.B},${q.C},${q.D},${q.correct}`).join('\n');
    const blob = new Blob([header+body], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='questions.csv'; a.click(); URL.revokeObjectURL(url);
  });

  // ===== 問答遊戲 =====
  const playerNameInput = document.getElementById('playerName');
  const startQuizBtn = document.getElementById('startQuizBtn');
  const quizArea = document.getElementById('quizArea');
  const quizResult = document.getElementById('quizResult');
  const questionText = document.getElementById('questionText');
  const optionsContainer = document.getElementById('optionsContainer');
  const confirmAnswerBtn = document.getElementById('confirmAnswerBtn');
  const playerSetup = document.getElementById('playerSetup');

  function renderQuestion(q){
    questionText.textContent = q.q;
    optionsContainer.innerHTML = '';
    ['A','B','C','D'].forEach(letter=>{
      const btn = document.createElement('button'); 
      btn.textContent = `${letter}: ${q[letter]}`; 
      btn.className = 'optionBtn';
      btn.addEventListener('click', ()=>{
        selectedAnswer = letter;
        document.querySelectorAll('.optionBtn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        confirmAnswerBtn.disabled = false;
      });
      optionsContainer.appendChild(btn);
    });
  }

  startQuizBtn.addEventListener('click', ()=>{
    playerName = playerNameInput.value.trim();

    if(playerName.length>16){alert("超過16個字元"); return;}
    if(/[^a-zA-Z0-9\u4e00-\u9fa5_]/.test(playerName)){alert("名稱有特殊字元"); return;}
    if(playerName===""){alert("名稱不合法"); return;}
    if(leaderboard.some(l=>l.name===playerName)){alert('名稱重複'); return;}

    playerSetup.style.display='none';
    quizArea.style.display='block';
    quizResult.style.display='none';
    currentQuestionIndex = 0; playerScore = 0; selectedAnswer = null;
    renderQuestion(questions[currentQuestionIndex]);
  });

  confirmAnswerBtn.addEventListener('click', ()=>{
    const correct = questions[currentQuestionIndex].correct;
    if(selectedAnswer===correct) playerScore++;
    currentQuestionIndex++;
    if(currentQuestionIndex>=questions.length){
      quizArea.style.display='none';
      quizResult.style.display='block';
      quizResult.textContent = `${playerName} 得分：${playerScore}`;
      leaderboard.push({name:playerName, score:playerScore});
      updateLeaderboardInFirestore();
      renderLeaderboard();
    } else {
      selectedAnswer=null; confirmAnswerBtn.disabled=true;
      renderQuestion(questions[currentQuestionIndex]);
    }
  });

  // ===== 排行榜 =====
  const leaderboardTableBody = document.querySelector('#leaderboardTable tbody');

  function renderLeaderboard(){
    leaderboardTableBody.innerHTML='';
    leaderboard.sort((a,b)=>b.score-a.score);
    leaderboard.forEach((p,i)=>{
      const tr = document.createElement('tr');
      let rankClass = '';
      if(i===0) rankClass='rank1';
      else if(i===1) rankClass='rank2';
      else if(i===2) rankClass='rank3';
      tr.className=rankClass;
      tr.innerHTML = `<td>${i+1}</td><td class="expandable">${p.name}</td><td>${p.score}</td>
        <td><button class="btn danger" data-index="${i}">刪除</button></td>`;
      leaderboardTableBody.appendChild(tr);
      tr.querySelector('.expandable').addEventListener('click',()=>{ tr.querySelector('.expandable').style.whiteSpace = (tr.querySelector('.expandable').style.whiteSpace==='normal'?'nowrap':'normal'); });
    });
    leaderboardTableBody.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', async e=>{
        if(!adminVerified){
          const pwd = await showPasswordModal("輸入管理員密碼");
          if(pwd==='CANCELLED'){alert("已取消");return;}
          if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤");return;}
          adminVerified=true;
        }
        if(confirm("確定刪除此名玩家嗎？")){
          const idx=parseInt(e.currentTarget.dataset.index);
          deleteLeaderboardPlayer(idx);
        }
      });
    });
  }

  // ===== Firestore 排行榜同步 =====
  async function updateLeaderboardInFirestore(){
    const batch = db.batch();
    const snapshot = await db.collection("leaderboard").get();
    snapshot.forEach(doc=>{ batch.delete(doc.ref); }); // 先清空 Firestore 排行榜
    leaderboard.forEach(p=>{
      const ref = db.collection("leaderboard").doc();
      batch.set(ref,p);
    });
    await batch.commit();
  }

  async function fetchLeaderboardFromFirestore(){
    leaderboard=[];
    const snapshot = await db.collection("leaderboard").get();
    snapshot.forEach(doc=>leaderboard.push(doc.data()));
    renderLeaderboard();
  }

  async function deleteLeaderboardPlayer(index){
    leaderboard.splice(index,1);
    await updateLeaderboardInFirestore();
    renderLeaderboard();
  }

  document.getElementById('clearLeaderboardBtn').addEventListener('click', async ()=>{
    if(!adminVerified){
      const pwd = await showPasswordModal("輸入管理員密碼");
      if(pwd==='CANCELLED'){alert("已取消");return;}
      if(pwd!==ADMIN_PASSWORD){alert("管理員密碼錯誤");return;}
      adminVerified=true;
    }
    if(confirm("確定要刪除所有排行榜嗎？")){
      leaderboard=[]; 
      await updateLeaderboardInFirestore(); 
      renderLeaderboard();
    }
  });

  fetchQuestions();
  fetchLeaderboardFromFirestore();
});
