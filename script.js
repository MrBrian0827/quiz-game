// ===== Firebase SDK 設定 =====
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

// ===== DOM & 狀態 =====
const sections = {
    menu: document.getElementById('menu'),
    quiz: document.getElementById('quiz'),
    questionManage: document.getElementById('questionManage'),
    leaderboard: document.getElementById('leaderboard')
};
const PLAYER_PASSWORD = "player123";
const ADMIN_PASSWORD = "admin123";

let adminVerified = false;
let adminDeleteVerified = false;
let questions = [], leaderboard = [];
let playerName = '', currentQuestionIndex = 0, playerScore = 0, selectedAnswer = null, startTime = 0;
let activePlayers = new Set(); // 遊戲中玩家名稱

// ===== Firebase 連線狀態 DOM =====
const connectionStatus = document.createElement('div');
connectionStatus.style.marginTop='12px';
connectionStatus.style.fontSize='0.9rem';
connectionStatus.style.textAlign='center';
connectionStatus.textContent='資料庫連線狀態：檢查中...';
document.querySelector('#menu').appendChild(connectionStatus);

document.getElementById('refreshConnection').addEventListener('click', checkFirebaseConnection);
async function checkFirebaseConnection(){
    try{
        await db.collection('questions').limit(1).get();
        connectionStatus.textContent='資料庫連線狀態：已連線';
    }catch(err){
        console.error(err);
        connectionStatus.textContent='資料庫連線狀態：無法連線';
    }
}

// ===== Modal 密碼 =====
const passwordModal=document.getElementById('passwordModal');
const modalTitle=document.getElementById('modalTitle');
const passwordInput=document.getElementById('passwordInput');
const passwordConfirmBtn=document.getElementById('passwordConfirmBtn');
const passwordCancelBtn=document.getElementById('passwordCancelBtn');
let passwordResolve = null;

function showPasswordModal(title){
    return new Promise(resolve=>{
        modalTitle.textContent=title;
        passwordInput.value="";
        passwordModal.style.display="flex";
        passwordInput.focus();
        passwordResolve = resolve;
    });
}
function hidePasswordModal(){ passwordModal.style.display="none"; }

passwordConfirmBtn.addEventListener('click', ()=>{ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); });
passwordCancelBtn.addEventListener('click', ()=>{ if(passwordResolve) passwordResolve('CANCELLED'); hidePasswordModal(); });
passwordInput.addEventListener('keydown', e=>{ if(e.key==="Enter"){ if(passwordResolve) passwordResolve(passwordInput.value); hidePasswordModal(); } });

// ===== Section 切換 =====
function showSection(name){
    Object.values(sections).forEach(s=>s.classList.remove('active'));
    sections[name].classList.add('active');
    if(name==="menu"){
        adminVerified=false;
        adminDeleteVerified=false;
    }
}

// ===== 主選單按鈕 =====
document.getElementById('goToQuiz').addEventListener('click', async ()=>{
    const pwd = await showPasswordModal("輸入玩家密碼");
    if(pwd==='CANCELLED'){ alert("已取消"); return; }
    if(pwd!==PLAYER_PASSWORD){ alert("玩家密碼錯誤"); return; }
    showSection('quiz');
});

document.getElementById('goToQuestionManage').addEventListener('click', async ()=>{
    if(!adminVerified){
        const pwd = await showPasswordModal("輸入管理員密碼");
        if(pwd==='CANCELLED'){ alert("已取消"); return; }
        if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
        adminVerified=true;
    }
    showSection('questionManage');
});

document.getElementById('goToLeaderboard').addEventListener('click', ()=>{ showSection('leaderboard'); });
document.querySelectorAll('.backBtn').forEach(btn=>{ btn.addEventListener('click', ()=> showSection(btn.dataset.back)); });
checkFirebaseConnection();

// ===== 題目管理 =====
const addQuestionBtn = document.getElementById('addQuestionBtn');
const importCSV = document.getElementById('importCSV');
const importBtn = document.getElementById('importBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const clearQuestionsBtn = document.getElementById('clearQuestionsBtn');
const questionTableBody = document.querySelector('#questionTable tbody');

async function fetchQuestionsFromFirestore(){
    try{
        questions=[];
        const snapshot=await db.collection('questions').orderBy('createdAt','asc').get();
        snapshot.forEach(doc=>questions.push({...doc.data(), id:doc.id}));
        renderQuestionTable();
    }catch(err){ console.error(err); }
}

function renderQuestionTable(){
    if(!questionTableBody) return;
    questionTableBody.innerHTML='';
    questions.forEach(q=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`
            <td class="expandable">${q.q}</td>
            <td class="expandable">${q.A}</td>
            <td class="expandable">${q.B}</td>
            <td class="expandable">${q.C}</td>
            <td class="expandable">${q.D}</td>
            <td>${q.correct}</td>
            <td><button class="btn danger" data-id="${q.id}">刪除</button></td>
        `;
        questionTableBody.appendChild(tr);

        tr.querySelectorAll('.expandable').forEach(td=>td.addEventListener('click', ()=>td.classList.toggle('expanded')));

        tr.querySelector('button').addEventListener('click', async ()=>{
            if(!adminDeleteVerified){
                const pwd = await showPasswordModal("輸入管理員密碼");
                if(pwd==='CANCELLED'){ showSection('menu'); return; }
                if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                adminDeleteVerified=true;
            }
            if(confirm("確定要刪除這題嗎？")){
                await db.collection('questions').doc(q.id).delete();
                fetchQuestionsFromFirestore();
            }
        });
    });
}

// 清空題目
if(clearQuestionsBtn){
    clearQuestionsBtn.addEventListener('click', async ()=>{
        if(!adminDeleteVerified){
            const pwd = await showPasswordModal("輸入管理員密碼確認");
            if(pwd==='CANCELLED'){ showSection('menu'); return; }
            if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
            adminDeleteVerified=true;
        }
        if(confirm("⚠️ 確定要刪除所有題目嗎？")){
            const snapshot = await db.collection('questions').get();
            for(const doc of snapshot.docs){
                await db.collection('questions').doc(doc.id).delete();
            }
            fetchQuestionsFromFirestore();
        }
    });
}

// CSV 匯入
importBtn.addEventListener('click', async ()=>{
    if(!importCSV.files.length){ alert('請選擇 CSV'); return; }
    const file=importCSV.files[0];
    const reader=new FileReader();
    reader.onload=async e=>{
        let lines = e.target.result.split(/\r?\n/).filter(l=>l.trim()!=='');

        let addedCount=0;
        for(let i=1;i<lines.length;i++){
            const cols = lines[i].split(',').map(s=>s.trim());
            if(cols.length<6) continue;
            let [q,A,B,C,D,correct]=cols;
            if(!q||!A||!B||!C||!D||!correct) continue;
            correct=correct.toUpperCase().trim().replace(/[\r\n]+/g,'');
            if(questions.some(item=>item.q===q)) continue;
            await db.collection('questions').add({q,A,B,C,D,correct, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
            addedCount++;
        }
        alert(`匯入完成，共新增 ${addedCount} 題`);
        fetchQuestionsFromFirestore();
    };
    reader.readAsText(file,'UTF-8');
});

// CSV 匯出
exportCSVBtn.addEventListener('click', async ()=>{
    const snapshot=await db.collection('questions').orderBy('createdAt','asc').get();
    const header='\uFEFF題目,A,B,C,D,正確答案\n';
    const body=snapshot.docs.map(doc=>`${doc.data().q},${doc.data().A},${doc.data().B},${doc.data().C},${doc.data().D},${doc.data().correct}`).join('\n');
    const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='questions.csv';
    a.click();
    URL.revokeObjectURL(url);
});

// 新增題目
addQuestionBtn.addEventListener('click', async ()=>{
    const q=document.getElementById('newQuestion').value.trim();
    const A=document.getElementById('optionA').value.trim();
    const B=document.getElementById('optionB').value.trim();
    const C=document.getElementById('optionC').value.trim();
    const D=document.getElementById('optionD').value.trim();
    let correct=document.getElementById('correctOption').value.trim().toUpperCase();
    if(!q||!A||!B||!C||!D||!correct){ alert("請完整填寫"); return; }
    if(!['A','B','C','D'].includes(correct)){ alert("正確答案需為 A~D"); return; }
    await db.collection('questions').add({q,A,B,C,D,correct, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    fetchQuestionsFromFirestore();
    document.getElementById('newQuestion').value='';
    document.getElementById('optionA').value='';
    document.getElementById('optionB').value='';
    document.getElementById('optionC').value='';
    document.getElementById('optionD').value='';
    document.getElementById('correctOption').value='';
});

// ===== 玩家限制功能 =====
function resetPlayerRestrictions(){
    if(confirm("確定要重置玩家每日限制嗎？")){
        localStorage.removeItem('deviceId'); 
        alert("玩家限制已重置");
    }
}

// ===== 問答遊戲 =====
const playerNameInput=document.getElementById('playerName');
const startQuizBtn=document.getElementById('startQuizBtn');
const playerSetup=document.getElementById('playerSetup');
const quizArea=document.getElementById('quizArea');
const quizResult=document.getElementById('quizResult');
const questionText=document.getElementById('questionText');
const optionsContainer=document.getElementById('optionsContainer');
const confirmAnswerBtn=document.getElementById('confirmAnswerBtn');

// 生成/取得裝置ID
function getDeviceId(){
    let id=localStorage.getItem('deviceId');
    if(!id){ id='dev-'+Math.random().toString(36).substr(2,12); localStorage.setItem('deviceId',id); }
    return id;
}
const deviceId = getDeviceId();

// 檢查是否今天可以玩
async function canPlayToday(name){
    const today = new Date().toISOString().split('T')[0];
    const snapshot=await db.collection('leaderboard')
        .where('date','==',today)
        .where('deviceId','==',deviceId).get();
    if(!snapshot.empty) return false;
    if(activePlayers.has(name)) return false;

    const snapshotName=await db.collection('leaderboard')
        .where('date','==',today)
        .where('name','==',name).get();
    return snapshotName.empty;
}

// 開始遊戲
startQuizBtn.addEventListener('click', async ()=>{
    playerName = playerNameInput.value.trim();
    if(!playerName){ alert("名稱必填"); return; }
    if(playerName.match(/\s/)){ alert("名稱不能包含空白"); return; }
    if(playerName.length>16){ alert("超過16個字元"); return; }

    if(activePlayers.has(playerName)){ alert("已經有相同玩家名稱!"); return; }

    const allowed = await canPlayToday(playerName);
    if(!allowed){ alert("您今天已完成問答遊戲"); return; }

    activePlayers.add(playerName);
    playerSetup.style.display='none';
    quizArea.style.display='block';
    quizResult.style.display='none';
    currentQuestionIndex=0;
    playerScore=0;
    selectedAnswer=null;
    startTime=Date.now();
    renderQuestion(questions[currentQuestionIndex]);
});

// 顯示題目
function renderQuestion(q){
    if(!q) return;
    questionText.textContent = q.q;
    optionsContainer.innerHTML='';
    ['A','B','C','D'].forEach(letter=>{
        const btn=document.createElement('button');
        btn.textContent=`${letter}: ${q[letter]}`;
        btn.className='btn optionBtn';
        btn.addEventListener('click', ()=>{
            selectedAnswer=letter;
            optionsContainer.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
            btn.classList.add('selected');
            confirmAnswerBtn.disabled=false;
        });
        optionsContainer.appendChild(btn);
    });
    confirmAnswerBtn.disabled=true;
}

// 確認答案
confirmAnswerBtn.addEventListener('click', ()=>{
    if(selectedAnswer===questions[currentQuestionIndex].correct) playerScore++;
    currentQuestionIndex++;
    if(currentQuestionIndex>=questions.length){ finishQuiz(); } 
    else{ selectedAnswer=null; renderQuestion(questions[currentQuestionIndex]); }
});

// 結束遊戲
function finishQuiz(){
    quizArea.style.display='none';
    const timeUsed=Math.floor((Date.now()-startTime)/1000);
    quizResult.style.display='block';
    quizResult.innerHTML=`${playerName}，答題完成！得分：${playerScore}，耗時：${timeUsed}秒<br><br>`;

    const restartBtn=document.createElement('button');
    restartBtn.textContent='重新開始';
    restartBtn.className='btn';
    restartBtn.addEventListener('click', ()=>{
        activePlayers.delete(playerName);
        playerNameInput.value='';
        quizResult.style.display='none';
        quizArea.style.display='none';
        playerSetup.style.display='block';
    });
    quizResult.appendChild(restartBtn);

    const today = new Date().toISOString().split('T')[0];
    db.collection('leaderboard').add({
        name: playerName,
        score: playerScore,
        time: timeUsed,
        date: today,
        deviceId: deviceId
    });
}

// ===== 排行榜 =====
const leaderboardTableBody=document.querySelector('#leaderboardTable tbody');
async function fetchLeaderboard(){
    const snapshot=await db.collection('leaderboard').orderBy('score','desc').get();
    leaderboard=[];
    snapshot.forEach(doc=>leaderboard.push({...doc.data(),id:doc.id}));
    renderLeaderboard();
}
function renderLeaderboard(){
    leaderboardTableBody.innerHTML='';
    leaderboard.forEach((p,i)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${i+1}</td><td>${p.name}</td><td>${p.score}</td><td>${p.time}</td><td><button class="btn danger" data-id="${p.id}">刪除</button></td>`;
        tr.querySelector('button').addEventListener('click', async ()=>{
            if(!adminDeleteVerified){
                const pwd = await showPasswordModal("輸入管理員密碼");
                if(pwd==='CANCELLED'){ return; }
                if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                adminDeleteVerified=true;
            }
            await db.collection('leaderboard').doc(p.id).delete();
            fetchLeaderboard();
        });
        leaderboardTableBody.appendChild(tr);
    });
}
document.getElementById('clearLeaderboardBtn')?.addEventListener('click', async ()=>{
    if(!adminDeleteVerified){
        const pwd = await showPasswordModal("輸入管理員密碼");
        if(pwd==='CANCELLED'){ return; }
        if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
        adminDeleteVerified=true;
    }
    if(confirm("⚠️ 確定要刪除排行榜?")){
        const snapshot = await db.collection('leaderboard').get();
        for(const doc of snapshot.docs){
            await db.collection('leaderboard').doc(doc.id).delete();
        }
        fetchLeaderboard();
    }
});

// ===== 初始抓取資料 =====
fetchQuestionsFromFirestore();
fetchLeaderboard();
