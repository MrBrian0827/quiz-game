// ===== 完整 script.js（已合併昨天進度 + 新需求） =====

// ===== Firebase SDK 設定 =====
const firebaseConfig = {
    apiKey: "AIzaSyAGLuyHZSLolwy9L5jIiX_5U_UxgjGpR4A",
    authDomain: "quizgamedatabase-e9882.firebaseapp.com",
    projectId: "quizgamedatabase-e9882",
    // 改成 appspot.com 避免 compat 版本偶發連線問題
    storageBucket: "quizgamedatabase-e9882.appspot.com",
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
let activePlayers = new Set(); // 遊戲中玩家名稱（本機）

// ===== Firebase 連線狀態 DOM =====
const connectionStatus = document.createElement('div');
connectionStatus.style.marginTop='12px';
connectionStatus.style.fontSize='0.9rem';
connectionStatus.style.textAlign='center';
connectionStatus.textContent='資料庫連線狀態：檢查中...';
document.querySelector('#menu').appendChild(connectionStatus);

const leaderboardStatus = document.getElementById('firebaseStatus');

document.getElementById('refreshConnection').addEventListener('click', checkFirebaseConnection);
async function checkFirebaseConnection(){
    try{
        await db.collection('questions').limit(1).get();
        connectionStatus.textContent='資料庫連線狀態：已連線';
        if(leaderboardStatus) leaderboardStatus.textContent='資料庫連線狀態：已連線';
    }catch(err){
        console.error('[checkFirebaseConnection]', err);
        connectionStatus.textContent='資料庫連線狀態：無法連線';
        if(leaderboardStatus) leaderboardStatus.textContent='資料庫連線狀態：無法連線';
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
        // focus 可能需延遲以確保顯示完畢
        setTimeout(()=>passwordInput.focus(), 0);
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
    if(sections[name]) sections[name].classList.add('active');
    // 回到主選單清除 admin 驗證狀態（按你原邏輯）
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

// ===== 題目管理：變更為即時訂閱 onSnapshot =====
const addQuestionBtn = document.getElementById('addQuestionBtn');
const importCSV = document.getElementById('importCSV');
const importBtn = document.getElementById('importBtn');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const clearQuestionsBtn = document.getElementById('clearQuestionsBtn');
const questionTableBody = document.querySelector('#questionTable tbody');

let unsubQuestions = null;
function subscribeQuestions(){
    if(unsubQuestions) unsubQuestions();
    try{
        unsubQuestions = db.collection('questions')
            .orderBy('createdAt','asc')
            .onSnapshot(snapshot=>{
                questions = [];
                snapshot.forEach(doc=>{
                    questions.push({...doc.data(), id:doc.id});
                });
                renderQuestionTable();
            }, err=>{
                console.error('[subscribeQuestions onSnapshot]', err);
                alert('題庫訂閱失敗（請檢查網路或 Firebase 設定）');
            });
    }catch(err){
        console.error('[subscribeQuestions]', err);
    }
}

// 兼容：保留 fetchQuestionsFromFirestore（若需要一次性抓取）
async function fetchQuestionsFromFirestore(){
    try{
        const snapshot = await db.collection('questions').orderBy('createdAt','asc').get();
        questions = [];
        snapshot.forEach(doc=> questions.push({...doc.data(), id:doc.id}));
        renderQuestionTable();
    }catch(err){
        console.error('[fetchQuestionsFromFirestore]', err);
    }
}

function renderQuestionTable(){
    if(!questionTableBody) return;
    questionTableBody.innerHTML='';
    questions.forEach(q=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`
            <td class="expandable">${escapeHtml(q.q)}</td>
            <td class="expandable">${escapeHtml(q.A)}</td>
            <td class="expandable">${escapeHtml(q.B)}</td>
            <td class="expandable">${escapeHtml(q.C)}</td>
            <td class="expandable">${escapeHtml(q.D)}</td>
            <td>${escapeHtml(q.correct)}</td>
            <td><button class="btn danger" data-id="${q.id}">刪除</button></td>
        `;
        questionTableBody.appendChild(tr);

        tr.querySelectorAll('.expandable').forEach(td=>td.addEventListener('click', ()=>td.classList.toggle('expanded')));

        tr.querySelector('button').addEventListener('click', async ()=>{
            try{
                if(!adminDeleteVerified){
                    const pwd = await showPasswordModal("輸入管理員密碼");
                    if(pwd==='CANCELLED') return;
                    if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                    adminDeleteVerified=true;
                }
                if(confirm("確定要刪除這題嗎？")){
                    await db.collection('questions').doc(q.id).delete();
                    // onSnapshot 會自動更新面板
                }
            }catch(err){
                console.error('[刪除單題]', err);
                alert('刪除題目失敗，請檢查網路或 Firebase 規則');
            }
        });
    });
}

// 清空題目（使用 batch，支援較大量刪除）
if(clearQuestionsBtn){
    clearQuestionsBtn.addEventListener('click', async ()=>{
        try{
            if(!adminDeleteVerified){
                const pwd = await showPasswordModal("輸入管理員密碼確認");
                if(pwd==='CANCELLED') return;
                if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                adminDeleteVerified=true;
            }
            if(confirm("⚠️ 確定要刪除所有題目嗎？")){
                const snapshot = await db.collection('questions').get();
                if(snapshot.empty) return;
                const batch = db.batch();
                snapshot.forEach(doc=> batch.delete(db.collection('questions').doc(doc.id)));
                await batch.commit();
                // onSnapshot 自動刷新
            }
        }catch(err){
            console.error('[一鍵刪除題目]', err);
            alert('刪除所有題目失敗，請檢查網路或 Firebase 規則');
        }
    });
}

// CSV 匯入
if(importBtn){
    importBtn.addEventListener('click', async ()=>{
        if(!importCSV.files.length){ alert('請選擇 CSV'); return; }
        const file=importCSV.files[0];
        const reader=new FileReader();
        reader.onload=async e=>{
            try{
                let lines = e.target.result.split(/\r?\n/).filter(l=>l.trim()!=='');
                let addedCount=0;
                for(let i=1;i<lines.length;i++){
                    const cols = parseCsvLine(lines[i]);
                    if(cols.length<6) continue;
                    let [q,A,B,C,D,correct]=cols;
                    if(!q||!A||!B||!C||!D||!correct) continue;
                    correct=correct.toUpperCase().trim().replace(/[\r\n]+/g,'');
                    if(questions.some(item=>item.q===q)) continue;
                    await db.collection('questions').add({
                        q,A,B,C,D,correct,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    addedCount++;
                }
                alert(`匯入完成，共新增 ${addedCount} 題`);
                // onSnapshot 自動刷新
            }catch(err){
                console.error('[CSV 匯入]', err);
                alert('CSV 匯入失敗');
            }
        };
        reader.readAsText(file,'UTF-8');
    });
}

// CSV 匯出
if(exportCSVBtn){
    exportCSVBtn.addEventListener('click', async ()=>{
        try{
            const snapshot=await db.collection('questions').orderBy('createdAt','asc').get();
            const header='\uFEFF題目,A,B,C,D,正確答案\n';
            const body=snapshot.docs.map(doc=>{
                const d = doc.data();
                const esc = s => `"${String(s ?? '').replace(/"/g,'""')}"`;
                return [d.q,d.A,d.B,d.C,d.D,d.correct].map(esc).join(',');
            }).join('\n');
            const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download='questions.csv';
            a.click();
            URL.revokeObjectURL(url);
        }catch(err){
            console.error('[CSV 匯出]', err);
            alert('CSV 匯出失敗');
        }
    });
}

// 新增題目（保留原邏輯）
if(addQuestionBtn){
    addQuestionBtn.addEventListener('click', async ()=>{
        try{
            const q=document.getElementById('newQuestion').value.trim();
            const A=document.getElementById('optionA').value.trim();
            const B=document.getElementById('optionB').value.trim();
            const C=document.getElementById('optionC').value.trim();
            const D=document.getElementById('optionD').value.trim();
            let correct=document.getElementById('correctOption').value.trim().toUpperCase();
            if(!q||!A||!B||!C||!D||!correct){ alert("請完整填寫"); return; }
            if(!['A','B','C','D'].includes(correct)){ alert("正確答案需為 A~D"); return; }
            await db.collection('questions').add({
                q,A,B,C,D,correct,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // 清空輸入框
            document.getElementById('newQuestion').value='';
            document.getElementById('optionA').value='';
            document.getElementById('optionB').value='';
            document.getElementById('optionC').value='';
            document.getElementById('optionD').value='';
            document.getElementById('correctOption').value='';
            // onSnapshot 自動刷新
        }catch(err){
            console.error('[新增題目]', err);
            alert('新增題目失敗');
        }
    });
}

// ===== 玩家限制功能 =====
function resetPlayerRestrictions(){
    if(confirm("確定要重置玩家每日限制嗎？")){
        localStorage.removeItem('deviceId');
        alert("玩家限制已重置");
    }
}
window.resetPlayerRestrictions = resetPlayerRestrictions; // 讓 index.html inline onclick 可以用

// ===== 問答遊戲 =====
const playerNameInput=document.getElementById('playerName');
const startQuizBtn=document.getElementById('startQuizBtn');
const playerSetup=document.getElementById('playerSetup');
const quizArea=document.getElementById('quizArea');
const quizResult=document.getElementById('quizResult');
const questionText=document.getElementById('questionText');
const optionsContainer=document.getElementById('optionsContainer');
const confirmAnswerBtn=document.getElementById('confirmAnswerBtn');

// 取得裝置 ID（限制同裝置一天一次）
function getDeviceId(){
    let id=localStorage.getItem('deviceId');
    if(!id){ id='dev-'+Math.random().toString(36).substr(2,12); localStorage.setItem('deviceId',id); }
    return id;
}
const deviceId = getDeviceId();

// 檢查名字是否存在於今日排行榜
async function nameExistsToday(name){
    try{
        const today=new Date().toISOString().split('T')[0];
        const snapshot = await db.collection('leaderboard').where('date','==',today).where('name','==',name).get();
        return !snapshot.empty;
    }catch(err){
        console.error('[nameExistsToday]', err);
        return false; // 若查詢失敗，不阻擋，但理想要提示
    }
}

// 檢查是否今天可以玩（裝置 + 名稱 + 正在遊戲）
async function canPlayToday(name){
    try{
        const today=new Date().toISOString().split('T')[0];
        const ownDeviceSnapshot = await db.collection('leaderboard').where('date','==',today).where('deviceId','==',deviceId).get();
        if(!ownDeviceSnapshot.empty) return false;
        if(activePlayers.has(name)) return false;
        const nameSnapshot = await db.collection('leaderboard').where('date','==',today).where('name','==',name).get();
        if(!nameSnapshot.empty) return false;
        return true;
    }catch(err){
        console.error('[canPlayToday]', err);
        return false;
    }
}

// 名稱格式檢查（中文/英文/數字/底線）
function validatePlayerNameInput(name){
    if(!name){ alert("名稱必填"); return false; }
    if(/\s/.test(name)){ alert("名稱不能包含空白"); return false; }
    if(name.length>16){ alert("超過16個字元"); return false; }
    const re = /^[\u4e00-\u9fa5_a-zA-Z0-9]+$/;
    if(!re.test(name)){ alert("只允許中文、英文、數字、底線"); return false; }
    return true;
}

// 開始遊戲
if(startQuizBtn){
    startQuizBtn.addEventListener('click', async ()=>{
        try{
            playerName = playerNameInput.value.trim();
            if(!validatePlayerNameInput(playerName)) return;

            if(activePlayers.has(playerName)){ alert("該玩家名稱正在遊戲中"); return; }

            // 先確認排行榜是否有相同名稱（同日）
            const today=new Date().toISOString().split('T')[0];
            const snapshotName = await db.collection('leaderboard').where('date','==',today).where('name','==',playerName).get();
            if(!snapshotName.empty){ alert("排行榜已有相同名稱"); return; }

            const allowed = await canPlayToday(playerName);
            if(!allowed){ alert("您今天已完成問答遊戲或同裝置已玩過"); return; }

            if(questions.length === 0){
                alert('題庫為空，請管理員先新增題目');
                return;
            }

            activePlayers.add(playerName);
            // 這邊使用 inline style 控制局部畫面（保留你原本的 quiz area display 控制）
            playerSetup.style.display='none';
            quizArea.style.display='block';
            quizResult.style.display='none';
            currentQuestionIndex=0;
            playerScore=0;
            selectedAnswer=null;
            startTime=Date.now();
            renderQuestion(questions[currentQuestionIndex]);
        }catch(err){
            console.error('[startQuizBtn click]', err);
            alert('開始遊戲失敗，請檢查網路');
        }
    });
}

// 顯示題目（與原邏輯一致）
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
if(confirmAnswerBtn){
    confirmAnswerBtn.addEventListener('click', async ()=>{
        if(!questions[currentQuestionIndex]) return;
        if(selectedAnswer===questions[currentQuestionIndex].correct) playerScore++;
        currentQuestionIndex++;
        if(currentQuestionIndex>=questions.length){ await finishQuiz(); } 
        else{ selectedAnswer=null; renderQuestion(questions[currentQuestionIndex]); }
    });
}

// 結束遊戲（寫入 leaderboard）
async function finishQuiz(){
    try{
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

        const today=new Date().toISOString().split('T')[0];
        await db.collection('leaderboard').add({
            name: playerName,
            score: playerScore,
            time: timeUsed,
            date: today,
            deviceId: deviceId
        });
        // onSnapshot 會自動將排行榜更新
    }catch(err){
        console.error('[finishQuiz]', err);
        alert('寫入排行榜失敗，請檢查網路或 Firebase 規則');
    }
}

// ===== 排行榜：用 onSnapshot 即時訂閱，主查詢只 orderBy('score','desc') =====
const leaderboardTableBody=document.querySelector('#leaderboardTable tbody');
let unsubLeaderboard = null;
function subscribeLeaderboard(){
    if(unsubLeaderboard) unsubLeaderboard();
    try{
        unsubLeaderboard = db.collection('leaderboard')
            .orderBy('score','desc')
            .onSnapshot(snapshot=>{
                leaderboard = [];
                snapshot.forEach(doc=> leaderboard.push({...doc.data(), id:doc.id}));
                // 同分情況前端以 time 升冪排序
                leaderboard.sort((a,b)=>{
                    if(b.score !== a.score) return b.score - a.score;
                    return (a.time ?? 999999) - (b.time ?? 999999);
                });
                renderLeaderboard();
                if(leaderboardStatus) leaderboardStatus.textContent = `資料庫連線狀態：已連線（${leaderboard.length} 筆）`;
            }, err=>{
                console.error('[subscribeLeaderboard onSnapshot]', err);
                if(leaderboardStatus) leaderboardStatus.textContent = '資料庫連線狀態：發生錯誤';
            });
    }catch(err){
        console.error('[subscribeLeaderboard]', err);
    }
}

function renderLeaderboard(){
    if(!leaderboardTableBody) return;
    leaderboardTableBody.innerHTML='';
    leaderboard.forEach((p,i)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${i+1}</td><td>${escapeHtml(p.name)}</td><td>${p.score}</td><td>${p.time}</td><td><button class="btn danger" data-id="${p.id}">刪除</button></td>`;
        if(i===0) tr.classList.add('gold');
        else if(i===1) tr.classList.add('silver');
        else if(i===2) tr.classList.add('bronze');

        tr.querySelector('button').addEventListener('click', async ()=>{
            try{
                if(!adminDeleteVerified){
                    const pwd = await showPasswordModal("輸入管理員密碼");
                    if(pwd==='CANCELLED') return;
                    if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                    adminDeleteVerified=true;
                }
                if(confirm("確定要刪除這筆排行榜資料嗎？")){
                    await db.collection('leaderboard').doc(p.id).delete();
                    // onSnapshot 自動更新
                }
            }catch(err){
                console.error('[刪除排行榜單筆]', err);
                alert('刪除排行榜失敗，請檢查網路或 Firebase 規則');
            }
        });
        leaderboardTableBody.appendChild(tr);
    });
}

// 清空排行榜（batch）
const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');
if(clearLeaderboardBtn){
    clearLeaderboardBtn.addEventListener('click', async ()=>{
        try{
            if(!adminDeleteVerified){
                const pwd = await showPasswordModal("輸入管理員密碼");
                if(pwd==='CANCELLED') return;
                if(pwd!==ADMIN_PASSWORD){ alert("管理員密碼錯誤"); return; }
                adminDeleteVerified=true;
            }
            if(confirm("⚠️ 確定要刪除排行榜?")){
                const snapshot = await db.collection('leaderboard').get();
                if(snapshot.empty) return;
                const batch = db.batch();
                snapshot.forEach(doc => batch.delete(db.collection('leaderboard').doc(doc.id)));
                await batch.commit();
                // onSnapshot 自動更新
            }
        }catch(err){
            console.error('[清空排行榜]', err);
            alert('刪除排行榜失敗，請檢查網路或 Firebase 規則');
        }
    });
}

// ===== 初始化 =====
function init(){
    subscribeQuestions();
    subscribeLeaderboard();
    checkFirebaseConnection();
}
if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
}else{
    init();
}

// ===== 工具函式 =====
function escapeHtml(str){
    if(str==null) return '';
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

// 簡單 CSV 行解析（處理 "..." 包含逗號）
function parseCsvLine(line){
    const res=[];
    let cur='';
    let inQuotes=false;
    for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch === '"' ){
            // 如果下個也是 " => escape
            if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; continue; }
            inQuotes = !inQuotes;
            continue;
        }
        if(ch === ',' && !inQuotes){
            res.push(cur);
            cur='';
            continue;
        }
        cur += ch;
    }
    res.push(cur);
    return res.map(s=>s.trim());
}
