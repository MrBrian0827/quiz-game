document.addEventListener('DOMContentLoaded',()=>{

// ===== 密碼設定 =====
// 玩家密碼（之後要改在這裡改）
const PLAYER_PASSWORD="player123";
// 管理員密碼（之後要改在這裡改）
const ADMIN_PASSWORD="admin123";
let adminVerified=false;

const NAME_REGEX=/^[\u4e00-\u9fa5A-Za-z0-9_]+$/;
const sections={
  menu:document.getElementById('menu'),
  quiz:document.getElementById('quiz'),
  questionManage:document.getElementById('questionManage'),
  leaderboard:document.getElementById('leaderboard'),
};

// ===== Modal =====
const passwordModal=document.getElementById('passwordModal');
const modalTitle=document.getElementById('modalTitle');
const passwordInput=document.getElementById('passwordInput');
const passwordConfirmBtn=document.getElementById('passwordConfirmBtn');
const passwordCancelBtn=document.getElementById('passwordCancelBtn');
let passwordResolve=null;

function showPasswordModal(title){
  return new Promise(resolve=>{
    modalTitle.textContent=title;
    passwordInput.value="";
    passwordModal.style.display="flex";
    passwordInput.focus();
    passwordResolve=resolve;
  });
}
function hidePasswordModal(){ passwordModal.style.display="none"; }

// Modal 按鈕事件
passwordConfirmBtn.addEventListener('click',()=>{
  if(passwordResolve) passwordResolve(passwordInput.value);
  hidePasswordModal();
});
passwordCancelBtn.addEventListener('click',()=>{
  if(passwordResolve) passwordResolve(null);
  hidePasswordModal();
});
// Enter 事件
passwordInput.addEventListener('keydown',e=>{
  if(e.key==="Enter"){
    if(passwordResolve) passwordResolve(passwordInput.value);
    hidePasswordModal();
  }
});

// ===== DOM 元素 =====
const goToQuiz=document.getElementById('goToQuiz');
const goToQuestionManage=document.getElementById('goToQuestionManage');
const goToLeaderboard=document.getElementById('goToLeaderboard');
const backBtns=document.querySelectorAll('.backBtn');

const playerSetup=document.getElementById('playerSetup');
const playerNameInput=document.getElementById('playerName');
const startQuizBtn=document.getElementById('startQuizBtn');
const quizArea=document.getElementById('quizArea');
const questionText=document.getElementById('questionText');
const optionsContainer=document.getElementById('optionsContainer');
const confirmAnswerBtn=document.getElementById('confirmAnswerBtn');
const quizResult=document.getElementById('quizResult');

const newQuestion=document.getElementById('newQuestion');
const optionA=document.getElementById('optionA');
const optionB=document.getElementById('optionB');
const optionC=document.getElementById('optionC');
const optionD=document.getElementById('optionD');
const correctOption=document.getElementById('correctOption');
const addQuestionBtn=document.getElementById('addQuestionBtn');
const importCSV=document.getElementById('importCSV');
const importBtn=document.getElementById('importBtn');
const exportCSVBtn=document.getElementById('exportCSVBtn');
const questionTableBody=document.querySelector('#questionTable tbody');
const leaderboardTableBody=document.querySelector('#leaderboardTable tbody');

let questions=JSON.parse(localStorage.getItem('questions')||'[]');
let leaderboard=JSON.parse(localStorage.getItem('leaderboard')||'[]');
let currentQuestionIndex=0, playerScore=0, selectedAnswer=null, playerName='';

// ===== Section 切換 =====
function showSection(name){
  Object.values(sections).forEach(s=>s.classList.remove('active'));
  sections[name].classList.add('active');
  if(name==='menu'){
    playerSetup.style.display='block';
    quizArea.style.display='none';
    quizResult.style.display='none';
    currentQuestionIndex=0;
    playerScore=0;
    selectedAnswer=null;
    playerNameInput.value='';
  }
  if(name==='quiz'){
    quizResult.style.display='none';
    quizArea.style.display='none';
    playerSetup.style.display='block';
  }
  if(name==='questionManage'){ renderQuestionTable(); }
  if(name==='leaderboard'){ renderLeaderboard(); }
}

// ===== 主選單事件 =====
goToQuiz.addEventListener('click', async ()=>{
  const pwd=await showPasswordModal("輸入玩家密碼");
  if(pwd!==PLAYER_PASSWORD){ alert("玩家密碼錯誤"); return; }
  showSection('quiz');
});

goToQuestionManage.addEventListener('click', async ()=>{
  if(!adminVerified){
    const pwd=await showPasswordModal("輸入管理員密碼");
    if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
    adminVerified=true;
  }
  showSection('questionManage');
});

goToLeaderboard.addEventListener('click', ()=>{
  showSection('leaderboard');
});

backBtns.forEach(btn=>{
  btn.addEventListener('click',()=>{
    showSection(btn.dataset.back);
    adminVerified=false; // 回主選單就重置管理員認證
  });
});

// ===== 題目管理 =====
function saveQuestions(){ localStorage.setItem('questions',JSON.stringify(questions)); }

function renderQuestionTable(){
  questionTableBody.innerHTML='';

  questions.forEach((q,i)=>{
    const tr=document.createElement('tr');

    // 題目（可點擊展開/收起）
    const tdQ=document.createElement('td');
    tdQ.textContent=q.q;
    tdQ.title=q.q;
    tdQ.style.cursor='pointer';
    // 初始為縮略顯示
    tdQ.style.whiteSpace='nowrap';
    tdQ.style.overflow='hidden';
    tdQ.style.textOverflow='ellipsis';
    tdQ.dataset.expanded='0';
    tdQ.addEventListener('click',()=>{
      const expanded = tdQ.dataset.expanded==='1';
      if(expanded){
        tdQ.style.whiteSpace='nowrap';
        tdQ.style.overflow='hidden';
        tdQ.style.textOverflow='ellipsis';
        tdQ.dataset.expanded='0';
      }else{
        tdQ.style.whiteSpace='normal';
        tdQ.style.overflow='visible';
        tdQ.style.textOverflow='clip';
        tdQ.dataset.expanded='1';
      }
    });
    tr.appendChild(tdQ);

    // A, B, C, D
    ['A','B','C','D'].forEach(k=>{
      const td=document.createElement('td');
      td.textContent=q[k];
      tr.appendChild(td);
    });

    // 正確答案
    const tdCorrect=document.createElement('td');
    tdCorrect.textContent=q.correct;
    tr.appendChild(tdCorrect);

    // 刪除按鈕（當頁一次驗證後不再重複）
    const tdDel=document.createElement('td');
    const delBtn=document.createElement('button');
    delBtn.className='btn danger';
    delBtn.textContent='刪除';
    delBtn.dataset.index=i;
    delBtn.addEventListener('click', async (e)=>{
      if(!adminVerified){
        const pwd=await showPasswordModal("輸入管理員密碼");
        if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
        adminVerified=true;
      }
      if(confirm('確定要刪除這題嗎？')){
        const idx=parseInt(e.currentTarget.dataset.index,10);
        questions.splice(idx,1);
        saveQuestions();
        renderQuestionTable();
      }
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    questionTableBody.appendChild(tr);
  });
}

addQuestionBtn.addEventListener('click',()=>{
  const q=newQuestion.value.trim(),
        A=optionA.value.trim(),
        B=optionB.value.trim(),
        C=optionC.value.trim(),
        D=optionD.value.trim(),
        correct=correctOption.value.trim().toUpperCase();
  if(!q||!A||!B||!C||!D||!['A','B','C','D'].includes(correct)){ alert('欄位有誤或正確答案錯誤'); return; }
  if(questions.some(item=>item.q===q)){ alert('題目重複'); return; }
  questions.push({q,A,B,C,D,correct});
  saveQuestions();
  renderQuestionTable();
  newQuestion.value=optionA.value=optionB.value=optionC.value=optionD.value=correctOption.value='';
});

// ===== CSV =====
importBtn.addEventListener('click',()=>{
  if(!importCSV.files.length){ alert('請選擇 CSV'); return; }
  const file=importCSV.files[0];
  const reader=new FileReader();
  reader.onload=e=>{
    let lines=e.target.result.split(/\r?\n/).filter(l=>l.trim()!=='');
    let addCount=0;
    for(let i=1;i<lines.length;i++){ // 跳過第一行欄位名稱
      const cols=lines[i].split(',').map(s=>s.trim());
      if(cols.length<6) continue;
      let [q,A,B,C,D,correct]=cols;
      if(!q||!A||!B||!C||!D||!correct) continue;
      correct=correct.toUpperCase().trim().replace(/[\r\n]+/g,'');
      if(questions.some(item=>item.q===q)) continue;
      questions.push({q,A,B,C,D,correct});
      addCount++;
    }
    saveQuestions();
    renderQuestionTable();
    alert(`匯入完成，共新增 ${addCount} 題`);
  };
  reader.readAsText(file,'UTF-8');
});

exportCSVBtn.addEventListener('click',()=>{
  const header='\uFEFF題目,A,B,C,D,正確答案\n';
  const body=questions.map(q=>`${q.q},${q.A},${q.B},${q.C},${q.D},${q.correct}`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='questions.csv'; a.click();
  URL.revokeObjectURL(url);
});

// ===== 問答遊戲 =====
startQuizBtn.addEventListener('click',()=>{
  const name=playerNameInput.value.trim();
  if(name.length>16){ alert('名稱不可超過16字'); return; }
  if(!NAME_REGEX.test(name)){ alert('名稱格式不正確'); return; }
  if(leaderboard.some(item=>item.name===name)){ alert("已有相同名稱的玩家存在"); return; }
  playerName=name;
  playerScore=0; currentQuestionIndex=0;
  playerSetup.style.display='none';
  quizArea.style.display='block';
  showQuestion();
});

function showQuestion(){
  if(currentQuestionIndex>=questions.length){ endQuiz(); return; }
  const q=questions[currentQuestionIndex];
  questionText.textContent=q.q;
  optionsContainer.innerHTML='';
  ['A','B','C','D'].forEach(opt=>{
    const btn=document.createElement('button');
    btn.className='optionBtn';
    btn.textContent=`${opt}: ${q[opt]}`;
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.optionBtn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAnswer=opt;
      confirmAnswerBtn.disabled=false;
    });
    optionsContainer.appendChild(btn);
  });
  selectedAnswer=null; confirmAnswerBtn.disabled=true;
}

confirmAnswerBtn.addEventListener('click',()=>{
  const q=questions[currentQuestionIndex];
  if(selectedAnswer && selectedAnswer.toUpperCase().trim()===q.correct) playerScore++;
  currentQuestionIndex++; showQuestion();
});

function endQuiz(){
  quizArea.style.display='none';
  quizResult.style.display='block';
  quizResult.innerHTML=`${playerName} 得分：${playerScore} 分`;
  leaderboard.push({name:playerName,score:playerScore});
  leaderboard.sort((a,b)=>b.score-a.score);
  localStorage.setItem('leaderboard',JSON.stringify(leaderboard));
}

// ===== 排行榜 =====
function renderLeaderboard(){
  leaderboardTableBody.innerHTML='';
  leaderboard.forEach((p,i)=>{
    const tr=document.createElement('tr');
    let bg='';
    if(i===0) bg='#ffd700'; else if(i===1) bg='#c0c0c0'; else if(i===2) bg='#cd7f32';
    tr.style.backgroundColor=bg;

    const tdRank=document.createElement('td');
    tdRank.textContent=i+1;

    const tdName=document.createElement('td');
    tdName.textContent=p.name;
    tdName.title=p.name;
    tdName.style.cursor='pointer';
    // 初始縮略
    tdName.style.whiteSpace='nowrap';
    tdName.style.overflow='hidden';
    tdName.style.textOverflow='ellipsis';
    tdName.dataset.expanded='0';
    tdName.addEventListener('click',()=>{
      const expanded = tdName.dataset.expanded==='1';
      if(expanded){
        tdName.style.whiteSpace='nowrap';
        tdName.style.overflow='hidden';
        tdName.style.textOverflow='ellipsis';
        tdName.dataset.expanded='0';
      }else{
        tdName.style.whiteSpace='normal';
        tdName.style.overflow='visible';
        tdName.style.textOverflow='clip';
        tdName.dataset.expanded='1';
      }
    });

    const tdScore=document.createElement('td');
    tdScore.textContent=p.score;

    const tdDel=document.createElement('td');
    const delBtn=document.createElement('button');
    delBtn.className='btn danger';
    delBtn.textContent='刪除';
    delBtn.dataset.index=i;
    delBtn.addEventListener('click', async (e)=>{
      if(!adminVerified){
        const pwd=await showPasswordModal("輸入管理員密碼");
        if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
        adminVerified=true;
      }
      if(confirm("確定要刪除這筆紀錄嗎？")){
        const idx=parseInt(e.currentTarget.dataset.index,10);
        leaderboard.splice(idx,1);
        localStorage.setItem('leaderboard',JSON.stringify(leaderboard));
        renderLeaderboard();
      }
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdScore);
    tr.appendChild(tdDel);

    leaderboardTableBody.appendChild(tr);
  });
}

}); // DOMContentLoaded
