import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onIdTokenChanged,getIdTokenResult} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,serverTimestamp,Timestamp,runTransaction} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const isAdmin=(c)=>c?.email==="luuhuong.nnpl@gmail.com"&&c?.email_verified===true&&c?.firebase?.sign_in_provider==="google.com";
const roleOf=(claims,grant,now)=>{if(isAdmin(claims))return "admin";if(claims?.email_verified!==true||claims?.firebase?.sign_in_provider!=="google.com"||!grant||grant.active!==true||!["advisor","student"].includes(grant.role))return "guest";if(grant.expiresAt!=null&&(!Number.isFinite(grant.expiresAt)||grant.expiresAt<=now))return "guest";return grant.role};
const el=id=>document.getElementById(id);
let auth,db,session=0,currentRole="guest",activeUser=null;
const say=(message,error=false)=>{el("authStatus").textContent=message;if(error)window.dispatchEvent(new CustomEvent("pna-auth-error",{detail:message}));};
const grantSay=s=>el("grantStatus").textContent=s;
function setRole(r,user,grant){currentRole=r;activeUser=user;el("authIdentity").textContent=user?(user.email+" · "+({admin:"Quản trị viên",advisor:"Cố vấn",student:"Sinh viên",guest:"Chưa được cấp quyền"}[r])):"Khách";el("authLogin").hidden=!!user;el("authLogout").hidden=!user;el("adminGrantPanel").hidden=r!=="admin";el("publishEditorial").hidden=r!=="admin";if(r!=="admin")el("publicationStatus").textContent="";el("builderCloudSave").hidden=r!=="admin";el("builderCloudLoad").hidden=r!=="admin";el("accessInfo").textContent=r==="admin"?"Quản trị viên duy nhất: có quyền cấp quyền và biên tập khung.":r==="guest"?"Chưa được cấp quyền. Không truy cập dữ liệu thật.":"Lớp hành chính: "+(grant?.classIds||[]).join(", ")+" | Lớp học phần: "+(grant?.courseIds||[]).join(", ");if(r!=="admin")el("grantList").replaceChildren();window.dispatchEvent(new CustomEvent("pna-auth",{detail:{role:r,uid:user?.uid??null}}))}
const codes=v=>[...new Set(v.split(",").map(s=>s.trim()).filter(Boolean))];
const validCodes=a=>a.length<=100&&a.every(x=>/^[A-Za-z0-9_-]{1,80}$/.test(x));
function guard(){if(currentRole!=="admin"||!activeUser||!db)throw Error("Chỉ quản trị viên được thao tác.")}
async function list(){guard();const s=await getDocs(collection(db,"accessGrants"));if(currentRole!=="admin")return;const root=el("grantList");root.replaceChildren();for(const d of s.docs){const g=d.data(),row=document.createElement("div");row.className="doc";const txt=document.createElement("span");txt.textContent=d.id+" · "+g.role+" · "+(g.active?"Đang cấp":"Đã thu hồi")+" · Lớp: "+(g.classIds||[]).join(", ")+" · HP: "+(g.courseIds||[]).join(", ");const edit=document.createElement("button");edit.type="button";edit.textContent="Sửa";edit.onclick=()=>{el("grantEmail").value=d.id;el("grantRole").value=g.role;el("grantClasses").value=(g.classIds||[]).join(",");el("grantCourses").value=(g.courseIds||[]).join(",");el("grantExpiry").value=g.expiresAt?new Date(g.expiresAt.toMillis()+7*3600000).toISOString().slice(0,10):""};const revoke=document.createElement("button");revoke.type="button";revoke.textContent="Thu hồi";revoke.disabled=!g.active;revoke.onclick=async()=>{if(!confirm("Thu hồi quyền của tài khoản này?"))return;try{guard();await setDoc(doc(db,"accessGrants",d.id),{...g,active:false,updatedAt:serverTimestamp(),updatedBy:activeUser.uid});grantSay("Đã thu hồi.");await list()}catch(e){grantSay("Không thu hồi được: "+(e.code||e.message))}};row.append(txt,edit,revoke);root.append(row)}}
el("grantForm").onsubmit=async e=>{e.preventDefault();try{guard();const email=el("grantEmail").value.trim().toLowerCase(),role=el("grantRole").value,classIds=codes(el("grantClasses").value),courseIds=codes(el("grantCourses").value),day=el("grantExpiry").value;if(!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email)||email==="luuhuong.nnpl@gmail.com"||!validCodes(classIds)||!validCodes(courseIds)||!["advisor","student"].includes(role)||(role==="advisor"&&!classIds.length)||(role==="student"&&!courseIds.length))throw Error("Email hoặc phạm vi không hợp lệ.");const expiresAt=day?Timestamp.fromDate(new Date(day+"T00:00:00+07:00")):null;if(expiresAt&&expiresAt.toMillis()<=Date.now())throw Error("Ngày hết hiệu lực phải ở tương lai.");await setDoc(doc(db,"accessGrants",email),{role,classIds,courseIds,active:true,expiresAt,updatedAt:serverTimestamp(),updatedBy:activeUser.uid});grantSay("Đã lưu quyền.");await list()}catch(e){grantSay("Không lưu được: "+(e.code||e.message))}};
el("grantReload").onclick=()=>list().catch(e=>grantSay("Không đọc được: "+(e.code||e.message)));
let publicRevision=null;
let publicReady=false;

async function refreshPublication(){
  const snapshot=await getDoc(doc(db,"systemLayouts","publishedEditorial"));
  publicRevision=snapshot.data()?.payload??null;
  publicReady=true;
  if(publicRevision)window.PNA_LAYOUT?.showPublication(publicRevision);
}

el("publishEditorial").onclick=async()=>{
  const button=el("publishEditorial");
  const status=el("publicationStatus");
  try {
    guard();
    if(!publicReady)await refreshPublication();
    const user=activeUser;
    guard();
    const editorial=window.PNA_LAYOUT?.publication();
    if(!editorial)throw Error("Bản nháp không hợp lệ.");
    const pages=editorial.pages.length;
    if(!pages&&!publicRevision)throw Error("Đặt ít nhất một trang ở trạng thái Sẵn sàng.");
    const message=pages ?
      "Công khai "+pages+" trang và "+editorial.collections.length+" cơ sở dữ liệu đính kèm cho mọi người truy cập PNA?" :
      "Gỡ nội dung đã xuất bản và trở về các trang hướng dẫn ban đầu?";
    if(!confirm(message))return;
    button.disabled=true;
    const payload=JSON.stringify(editorial);
    const expected=publicRevision;
    const ref=doc(db,"systemLayouts","publishedEditorial");
    await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(ref);
      if(activeUser?.uid!==user.uid||currentRole!=="admin")throw Error("Phiên quản trị đã thay đổi.");
      if((snapshot.data()?.payload??null)!==expected)throw Error("Bản công khai đã thay đổi. Tải lại trang trước khi xuất bản.");
      transaction.set(ref,{payload,version:1,publishedAt:serverTimestamp()});
    });
    publicRevision=payload;
    window.PNA_LAYOUT?.showPublication(payload);
    if(activeUser?.uid===user.uid&&currentRole==="admin")status.textContent=pages ?
      "Đã xuất bản "+pages+" trang trên PNA." : "Đã trở về nội dung hướng dẫn ban đầu.";
  }catch(e){
    status.textContent="Chưa xuất bản được: "+(e.code==="permission-denied"?"Firebase chưa cho phép công bố nội dung.":e.message);
  }finally{button.disabled=false}
};

el("builderCloudSave").onclick=async()=>{
  try {
    guard();
    if(!confirm("Đồng bộ bản nháp riêng của quản trị viên lên Firebase?"))return;
    const user=activeUser;
    const ref=doc(db,"systemLayouts","adminDraft");
    const saved=await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(ref);
      if(activeUser?.uid!==user.uid||currentRole!=="admin")throw Error("Phiên quản trị đã thay đổi.");
      const payload=window.PNA_LAYOUT?.read(snapshot.data()?.payload);
      if(typeof payload!=="string"||new TextEncoder().encode(payload).length>500000)throw Error("Bản nháp vượt giới hạn.");
      transaction.set(ref,{payload,version:1,updatedAt:serverTimestamp(),updatedBy:user.uid});
      return payload;
    });
    if(activeUser?.uid!==user.uid||currentRole!=="admin")return;
    window.PNA_LAYOUT?.saved(saved);
    el("builderStatus").textContent="Đã lưu bản nháp Firebase.";
  }catch(e){el("builderStatus").textContent="Không lưu được Firebase: "+(e.code||e.message)}
};
el("builderCloudLoad").onclick=async()=>{
  try {
    guard();
    const user=activeUser;
    const snap=await getDoc(doc(db,"systemLayouts","adminDraft"));
    if(activeUser?.uid!==user.uid||currentRole!=="admin")return;
    if(!snap.exists())throw Error("Chưa có bản nháp trên Firebase.");
    if(!confirm("Thay bản nháp trên trình duyệt này bằng bản Firebase?"))return;
    if(!window.PNA_LAYOUT?.load(snap.data().payload))throw Error("Bản nháp không hợp lệ.");
    el("builderStatus").textContent="Đã tải bản nháp Firebase.";
  }catch(e){el("builderStatus").textContent="Không tải được Firebase: "+(e.code||e.message)}
};
try{
const res=await fetch(new URL("../firebase-config.json",import.meta.url),{cache:"no-store"});if(!res.ok)throw Error("Chưa có cấu hình Firebase Web App");const config=await res.json();if(config.projectId!=="academic-advising-center"||!config.apiKey||!config.appId||!config.authDomain)throw Error("Cần cấu hình Web App của academic-advising-center");
const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);el("authLogin").disabled=false;
refreshPublication().catch(()=>{});
el("authLogin").onclick=async()=>{try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});await signInWithPopup(auth,provider)}catch(e){say("Đăng nhập chưa thành công: "+(e.code||e.message),true)}};
el("authLogout").onclick=async()=>{try{await signOut(auth)}catch(e){say("Không đăng xuất được: "+(e.code||e.message),true)}};
onIdTokenChanged(auth,async user=>{const seq=++session;if(!user||user.uid!==activeUser?.uid)setRole("guest",user,null);if(!user){say("Chưa đăng nhập. Chỉ đang xem dữ liệu demo.");return}try{const c=(await getIdTokenResult(user)).claims;if(seq!==session)return;let g=null;if(!isAdmin(c)&&c.email_verified===true&&c.firebase?.sign_in_provider==="google.com"){const s=await getDoc(doc(db,"accessGrants",String(c.email)));if(s.exists()){const data=s.data();g={...data,expiresAt:data.expiresAt?data.expiresAt.toMillis():null}}}if(seq!==session)return;const r=roleOf(c,g,Date.now());setRole(r,user,g);say(r==="guest"?"Đã đăng nhập nhưng chưa có quyền hợp lệ.":"Đã xác thực Google. Dữ liệu nghiệp vụ bên ngoài trang phân quyền vẫn là demo.");if(r==="admin")list().catch(e=>grantSay("Chưa đọc được quyền Firebase: "+(e.code||e.message)))}catch(e){if(seq!==session)return;setRole("guest",user,null);say("Chưa xác minh được quyền: "+(e.code||e.message),true)}});
}catch(e){say("Chưa kết nối Firebase: "+(e.message||e.code)+".",true);el("authIdentity").textContent="Khách · Firebase chưa cấu hình";}
