import { before, after, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, Timestamp, deleteDoc } from "firebase/firestore";
let env;
const projectId="demo-pna";
const adminEmail="luuhuong.nnpl@gmail.com";
const google=email=>({email,email_verified:true,firebase:{sign_in_provider:"google.com"}});
const client=(uid,email,overrides={})=>env.authenticatedContext(uid,{...google(email),...overrides}).firestore();
const admin=()=>client("admin",adminEmail);
const advisor=()=>client("advisor","advisor@example.test");
const student=()=>client("student","student@example.test");
const outsider=()=>client("outside","outside@example.test");
const guest=()=>env.unauthenticatedContext().firestore();
const ref=(db,path)=>doc(db,path);
const grant=(role,classIds,courseIds,extra={})=>({role,classIds,courseIds,active:true,expiresAt:null,updatedAt:Timestamp.now(),updatedBy:"admin",...extra});
const newGrant=(db,email,data)=>setDoc(ref(db,"accessGrants/"+email),{...data,updatedAt:serverTimestamp(),updatedBy:"admin"});
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{rules:readFileSync("firestore.rules","utf8")}})});
after(async()=>{if(env)await env.cleanup()});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await Promise.all([
setDoc(ref(db,"accessGrants/advisor@example.test"),grant("advisor",["A1"],["HP1"])),
setDoc(ref(db,"accessGrants/student@example.test"),grant("student",["A1"],["HP1"])),
setDoc(ref(db,"accessGrants/expired@example.test"),grant("advisor",["A1"],[],{expiresAt:Timestamp.fromMillis(1)})),
setDoc(ref(db,"accessGrants/revoked@example.test"),grant("advisor",["A1"],[],{active:false})),
setDoc(ref(db,"administrativeClasses/A1"),{name:"Synthetic A1"}),
setDoc(ref(db,"administrativeClasses/A2"),{name:"Synthetic A2"}),
setDoc(ref(db,"courseSections/HP1"),{name:"Synthetic HP1"}),
setDoc(ref(db,"courseSections/HP2"),{name:"Synthetic HP2"}),
setDoc(ref(db,"systemLayouts/adminDraft"),{payload:"{}",version:1,updatedAt:Timestamp.now(),updatedBy:"admin"}),
setDoc(ref(db,"students/S1"),{synthetic:true})
])})});
test("guest cannot read grants, class, draft or student",async()=>{for(const path of ["accessGrants/advisor@example.test","administrativeClasses/A1","systemLayouts/adminDraft","students/S1"])await assertFails(getDoc(ref(guest(),path)))});
test("admin can list grants",async()=>assertSucceeds(getDocs(collection(admin(),"accessGrants"))));
test("admin can create advisor grant",async()=>assertSucceeds(newGrant(admin(),"new@example.test",grant("advisor",["A1"],[]))));
test("admin can create student grant with course",async()=>assertSucceeds(newGrant(admin(),"new@example.test",grant("student",[],["HP1"]))));
test("student grant without course denied",async()=>assertFails(newGrant(admin(),"new@example.test",grant("student",["A1"],[]))));
test("advisor grant without administrative class denied",async()=>assertFails(newGrant(admin(),"new@example.test",grant("advisor",[],["HP1"]))));
test("admin role cannot be delegated",async()=>assertFails(newGrant(admin(),"new@example.test",grant("admin",["A1"],[]))));
test("advisor cannot self escalate",async()=>assertFails(newGrant(advisor(),"advisor@example.test",grant("advisor",["A2"],[]))));
test("advisor can read own grant only",async()=>{await assertSucceeds(getDoc(ref(advisor(),"accessGrants/advisor@example.test")));await assertFails(getDoc(ref(advisor(),"accessGrants/student@example.test")));await assertFails(getDocs(collection(advisor(),"accessGrants")))});
test("assigned class only",async()=>{await assertSucceeds(getDoc(ref(advisor(),"administrativeClasses/A1")));await assertFails(getDoc(ref(advisor(),"administrativeClasses/A2")))});
test("assigned course only",async()=>{await assertSucceeds(getDoc(ref(student(),"courseSections/HP1")));await assertFails(getDoc(ref(student(),"courseSections/HP2")))});
test("expired and revoked rights fail",async()=>{for(const email of ["expired@example.test","revoked@example.test"])await assertFails(getDoc(ref(client(email,email),"administrativeClasses/A1")))});
test("unknown user cannot read classes",async()=>assertFails(getDoc(ref(outsider(),"administrativeClasses/A1"))));
test("unverified email cannot use admin privileges",async()=>assertFails(getDocs(collection(client("fake",adminEmail,{email_verified:false}),"accessGrants"))));
test("password provider cannot use admin privileges",async()=>assertFails(getDocs(collection(client("fake",adminEmail,{firebase:{sign_in_provider:"password"}}),"accessGrants"))));
test("admin can update draft, others cannot",async()=>{await assertSucceeds(setDoc(ref(admin(),"systemLayouts/adminDraft"),{payload:"{}",version:1,updatedAt:serverTimestamp(),updatedBy:"admin"}));await assertFails(getDoc(ref(advisor(),"systemLayouts/adminDraft")));await assertFails(setDoc(ref(advisor(),"systemLayouts/adminDraft"),{payload:"{}",version:1,updatedAt:serverTimestamp(),updatedBy:"advisor"}))});
test("admin cannot delete grant or draft",async()=>{await assertFails(deleteDoc(ref(admin(),"accessGrants/advisor@example.test")));await assertFails(deleteDoc(ref(admin(),"systemLayouts/adminDraft")))});
test("unknown collections and writes default deny even for admin",async()=>{await assertFails(getDoc(ref(admin(),"students/S1")));await assertFails(setDoc(ref(admin(),"administrativeClasses/A1"),{name:"New"}))});

const publicationPath = "systemLayouts/publishedEditorial";
const publication = () => ({payload:'{"version":1,"pages":[],"collections":[]}',version:1,publishedAt:serverTimestamp()});
test("only the published snapshot has public read access",async()=>{
  await assertSucceeds(setDoc(ref(admin(),publicationPath),publication()));
  await assertSucceeds(getDoc(ref(guest(),publicationPath)));
  await assertFails(getDoc(ref(guest(),"systemLayouts/adminDraft")));
  await assertFails(getDocs(collection(guest(),"systemLayouts")));
});
test("only the verified administrator can publish and the same schema applies to changes",async()=>{
  for (const db of [guest(),advisor(),student(),client("fake",adminEmail,{email_verified:false})]) {
    await assertFails(setDoc(ref(db,publicationPath),publication()));
  }
  await assertSucceeds(setDoc(ref(admin(),publicationPath),publication()));
  await assertSucceeds(setDoc(ref(admin(),publicationPath),publication()));
  await assertFails(setDoc(ref(admin(),publicationPath),{...publication(),privateDraft:"x"}));
  await assertFails(setDoc(ref(admin(),publicationPath),{...publication(),publishedAt:Timestamp.fromMillis(1)}));
  await assertFails(setDoc(ref(admin(),publicationPath),{...publication(),payload:""}));
  await assertFails(deleteDoc(ref(admin(),publicationPath)));
});
